"""Tests du service LIVRAISON, contre PostgreSQL uniquement.

Même contrainte que `test_commande_service.py` : la chaîne remonte à `COMMANDE`,
qui référence `RESERVATION`, dont le `CHECK` d'exclusivité utilise la syntaxe
PostgreSQL `(colonne IS NOT NULL)::int`. SQLite refuse la table et résout la clé
étrangère à l'insertion même lorsque la colonne est NULL.

Le cœur du module est `test_affectation_refuse_une_mauvaise_fonction` : c'est la
seule garantie qu'un cuisinier ne part pas en tournée, la clé étrangère pointant
vers `PERSONNEL` tout entier.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.security import hacher_mot_de_passe
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.commande import STATUT_TERMINAL, StatutCommande, TypeCommande
from app.models.livraison import StatutLivraison
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.produit import Produit
from app.schemas.commande import CommandeCreate
from app.schemas.ligne_commande import LigneCommandeCreate
from app.services.commande_service import CommandeService
from app.services.livraison_service import LivraisonService

pytestmark = pytest.mark.postgres

ADRESSE = "Lot II M 45 Antananarivo"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    """Alias local : tous les tests de ce module passent par PostgreSQL."""
    return session_postgres


@pytest.fixture
def service(db: Session) -> LivraisonService:
    return LivraisonService(db)


@pytest.fixture
def commandes(db: Session) -> CommandeService:
    return CommandeService(db)


@pytest.fixture
def client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


@pytest.fixture
def eclair(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=100,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _salarie(db: Session, fonction: FonctionPersonnel) -> Personnel:
    personnel = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=fonction,
        email=f"{fonction.value.lower()}_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(personnel)
    db.commit()
    return personnel


def _commande(id_produit: int, adresse: str | None = ADRESSE, **extra: object):
    return CommandeCreate(
        type_commande=extra.pop("type_commande", TypeCommande.EN_LIGNE),
        adresse_livraison=adresse,
        lignes=[LigneCommandeCreate(id_produit=id_produit, quantite=1)],
    )


# --- Création automatique -----------------------------------------------------


def test_adresse_fournie_cree_une_livraison(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
) -> None:
    commande = commandes.creer(_commande(eclair.id_produit), client)

    livraison = service.livraisons.get_by_commande(commande.id_commande)
    assert livraison is not None
    assert livraison.statut is StatutLivraison.EN_ATTENTE


def test_sans_adresse_aucune_livraison(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
) -> None:
    """C'est la présence de l'adresse qui demande une livraison, et rien d'autre."""
    commande = commandes.creer(_commande(eclair.id_produit, adresse=None), client)

    assert service.livraisons.get_by_commande(commande.id_commande) is None


def test_adresse_recopiee_et_non_partagee(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
) -> None:
    """La livraison est un fait logistique, la commande un fait commercial.

    Corriger l'adresse d'une tournée ne doit pas réécrire la commande.
    """
    commande = commandes.creer(_commande(eclair.id_produit), client)
    livraison = service.livraisons.get_by_commande(commande.id_commande)
    assert livraison is not None

    livraison.adresse_livraison = "Autre adresse"
    service.db.commit()

    assert commande.adresse_livraison == ADRESSE


def test_livraison_naît_sans_livreur_ni_date(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
) -> None:
    """`NULL` signifie « pas encore affectée » et « pas encore planifiée »."""
    commande = commandes.creer(_commande(eclair.id_produit), client)

    livraison = service.livraisons.get_by_commande(commande.id_commande)
    assert livraison is not None
    assert livraison.id_personnel is None
    assert livraison.date_heure_prevue is None


def test_commande_sur_place_avec_adresse_refusee(
    commandes: CommandeService, client: Client, eclair: Produit
) -> None:
    """On ne livre pas quelqu'un attablé : la contradiction vient d'une saisie."""
    with pytest.raises(ReferenceInvalide):
        commandes.creer(
            _commande(eclair.id_produit, type_commande=TypeCommande.SUR_PLACE), client
        )


def test_produit_non_livrable_refuse_la_livraison(
    commandes: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Accepter reviendrait à promettre une tournée qu'on ne peut pas faire."""
    eclair.est_livrable = False
    db.commit()

    with pytest.raises(ReferenceInvalide):
        commandes.creer(_commande(eclair.id_produit), client)


def test_une_seule_ligne_non_livrable_suffit(
    commandes: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Il n'existe pas de livraison partielle : `UNIQUE (id_commande)`."""
    encombrant = Produit(
        nom="Pièce montée",
        prix_unitaire=Decimal("120.00"),
        unite_mesure="piece",
        stock_disponible=5,
        est_livrable=False,
        id_categorie=eclair.id_categorie,
    )
    db.add(encombrant)
    db.commit()

    with pytest.raises(ReferenceInvalide):
        commandes.creer(
            CommandeCreate(
                type_commande=TypeCommande.EN_LIGNE,
                adresse_livraison=ADRESSE,
                lignes=[
                    LigneCommandeCreate(id_produit=eclair.id_produit, quantite=1),
                    LigneCommandeCreate(id_produit=encombrant.id_produit, quantite=1),
                ],
            ),
            client,
        )


def test_refus_n_ecrit_ni_commande_ni_livraison(
    commandes: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Tout se joue dans une transaction."""
    eclair.est_livrable = False
    db.commit()

    with pytest.raises(ReferenceInvalide):
        commandes.creer(_commande(eclair.id_produit), client)
    db.rollback()

    assert commandes.lister_du_client(client) == []


# --- Affectation d'un livreur -------------------------------------------------


@pytest.fixture
def livraison(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
):
    commande = commandes.creer(_commande(eclair.id_produit), client)
    creee = service.livraisons.get_by_commande(commande.id_commande)
    assert creee is not None
    return creee


def test_affectation_d_un_livreur(
    service: LivraisonService, livraison, db: Session
) -> None:
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)

    affectee = service.affecter_livreur(livraison.id_livraison, livreur.id_personnel)

    assert affectee.id_personnel == livreur.id_personnel


@pytest.mark.parametrize(
    "fonction",
    [
        FonctionPersonnel.CUISINIER,
        FonctionPersonnel.FORMATEUR,
        FonctionPersonnel.RECEPTIONNISTE,
        FonctionPersonnel.AUTRE,
    ],
)
def test_affectation_refuse_une_mauvaise_fonction(
    service: LivraisonService, livraison, db: Session, fonction: FonctionPersonnel
) -> None:
    """Le cœur de l'issue.

    `LIVRAISON.#id_personnel` pointe vers `PERSONNEL` tout entier : rien en base
    n'empêche d'y mettre un cuisinier. C'est ce test, et lui seul, qui garantit
    que le service refuse.
    """
    intrus = _salarie(db, fonction)

    with pytest.raises(ReferenceInvalide) as capture:
        service.affecter_livreur(livraison.id_livraison, intrus.id_personnel)

    assert fonction.value in str(capture.value)


def test_affectation_refuse_un_salarie_archive(
    service: LivraisonService, livraison, db: Session
) -> None:
    """Affecter une tournée à quelqu'un qui a quitté l'entreprise n'a pas de sens.

    L'archivage est posé directement sur le modèle plutôt que par le service :
    ce test porte sur l'affectation, il n'a pas à connaître le chemin par lequel
    un salarié est archivé.
    """
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)
    livreur.supprime_le = datetime.now(UTC)
    db.commit()

    with pytest.raises(ReferenceInvalide):
        service.affecter_livreur(livraison.id_livraison, livreur.id_personnel)


def test_affectation_refuse_un_inconnu(service: LivraisonService, livraison) -> None:
    """422 : l'identifiant vient du corps, pas de l'URL."""
    with pytest.raises(ReferenceInvalide):
        service.affecter_livreur(livraison.id_livraison, 99999)


def test_reaffectation_permise_tant_que_non_terminee(
    service: LivraisonService, livraison, db: Session
) -> None:
    """Un livreur peut tomber malade."""
    premier = _salarie(db, FonctionPersonnel.LIVREUR)
    second = _salarie(db, FonctionPersonnel.LIVREUR)
    service.affecter_livreur(livraison.id_livraison, premier.id_personnel)

    affectee = service.affecter_livreur(livraison.id_livraison, second.id_personnel)

    assert affectee.id_personnel == second.id_personnel


# --- Statut -------------------------------------------------------------------


def test_en_cours_exige_un_livreur(service: LivraisonService, livraison) -> None:
    """Personne ne part en tournée sans être désigné."""
    with pytest.raises(ConflitMetier):
        service.changer_statut(livraison.id_livraison, StatutLivraison.EN_COURS)


def test_passage_a_livree_pose_la_date_reelle(
    service: LivraisonService, livraison, db: Session
) -> None:
    """L'horloge du serveur fait foi, la requête ne fournit aucune date."""
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)
    service.affecter_livreur(livraison.id_livraison, livreur.id_personnel)
    service.changer_statut(livraison.id_livraison, StatutLivraison.EN_COURS)

    terminee = service.changer_statut(livraison.id_livraison, StatutLivraison.LIVREE)

    assert terminee.date_heure_reelle is not None


@pytest.mark.parametrize("statut", [StatutLivraison.ECHOUEE, StatutLivraison.ANNULEE])
def test_echec_et_annulation_ne_posent_pas_de_date_reelle(
    service: LivraisonService, livraison, statut: StatutLivraison
) -> None:
    """Il n'y a pas eu de remise."""
    terminee = service.changer_statut(livraison.id_livraison, statut)

    assert terminee.date_heure_reelle is None


@pytest.mark.parametrize(
    "terminal",
    [StatutLivraison.LIVREE, StatutLivraison.ECHOUEE, StatutLivraison.ANNULEE],
)
def test_une_livraison_terminee_ne_bouge_plus(
    service: LivraisonService, livraison, db: Session, terminal: StatutLivraison
) -> None:
    """Rouvrir une tournée effacerait la trace de ce qui s'est passé."""
    service.changer_statut(livraison.id_livraison, terminal)

    with pytest.raises(ConflitMetier):
        service.changer_statut(livraison.id_livraison, StatutLivraison.EN_ATTENTE)


def test_une_livraison_terminee_n_accepte_plus_de_livreur(
    service: LivraisonService, livraison, db: Session
) -> None:
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)
    service.changer_statut(livraison.id_livraison, StatutLivraison.ANNULEE)

    with pytest.raises(ConflitMetier):
        service.affecter_livreur(livraison.id_livraison, livreur.id_personnel)


# --- Planification, lecture, archivage ----------------------------------------


def test_planification(service: LivraisonService, livraison) -> None:
    prevue = datetime.now(UTC) + timedelta(hours=3)

    planifiee = service.planifier(livraison.id_livraison, prevue)

    assert planifiee.date_heure_prevue is not None


def test_obtenir_inconnue_leve_introuvable(service: LivraisonService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_commande_sans_livraison_leve_introuvable(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
) -> None:
    commande = commandes.creer(_commande(eclair.id_produit, adresse=None), client)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_par_commande(commande.id_commande)


def test_filtre_par_statut(service: LivraisonService, livraison) -> None:
    assert len(service.lister(StatutLivraison.EN_ATTENTE)) >= 1
    assert service.lister(StatutLivraison.LIVREE) == []


def test_archivage_ne_touche_pas_la_commande(
    service: LivraisonService, commandes: CommandeService, livraison
) -> None:
    """La commande reste un fait commercial indépendant de la tournée."""
    id_commande = livraison.id_commande

    service.supprimer(livraison.id_livraison)

    assert commandes.obtenir(id_commande) is not None
    assert service.livraisons.get_by_commande(id_commande) is None


# --- Synchronisation LIVRAISON -> COMMANDE ------------------------------------


def _livraison_de(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    id_produit: int,
    type_commande: TypeCommande = TypeCommande.EN_LIGNE,
):
    commande = commandes.creer(
        _commande(id_produit, type_commande=type_commande), client
    )
    creee = service.livraisons.get_by_commande(commande.id_commande)
    assert creee is not None
    return commande, creee


@pytest.mark.parametrize(
    "type_commande", [TypeCommande.EN_LIGNE, TypeCommande.A_EMPORTER]
)
def test_livree_propage_sur_la_commande(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
    db: Session,
    type_commande: TypeCommande,
) -> None:
    """Les deux seuls types de commande qui peuvent porter une livraison.

    `Sur_place` en est exclu par construction — il ne peut pas porter d'adresse
    —, ce que `test_sur_place_ne_peut_pas_atteindre_cette_propagation` vérifie.
    Tous deux mènent à `Livree` d'après `STATUT_TERMINAL`.
    """
    commande, livraison = _livraison_de(
        commandes, service, client, eclair.id_produit, type_commande
    )
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)
    service.affecter_livreur(livraison.id_livraison, livreur.id_personnel)

    service.changer_statut(livraison.id_livraison, StatutLivraison.LIVREE)

    assert commande.statut is STATUT_TERMINAL[type_commande]
    assert commande.statut is StatutCommande.LIVREE


def test_echouee_laisse_la_commande_strictement_inchangee(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
) -> None:
    """Un échec de tournée n'est pas une annulation.

    La marchandise a été préparée, le montant reste dû, et relancer, rembourser
    ou annuler est une décision humaine. Basculer automatiquement trancherait à
    la place de l'administrateur.
    """
    commande, livraison = _livraison_de(commandes, service, client, eclair.id_produit)
    statut_avant = commande.statut

    service.changer_statut(livraison.id_livraison, StatutLivraison.ECHOUEE)

    assert commande.statut is statut_avant
    assert commande.statut is StatutCommande.EN_ATTENTE
    assert commande.statut is not StatutCommande.ANNULEE


@pytest.mark.parametrize(
    "statut",
    [
        StatutLivraison.EN_ATTENTE,
        StatutLivraison.EN_COURS,
        StatutLivraison.ECHOUEE,
        StatutLivraison.ANNULEE,
    ],
)
def test_seul_livree_propage(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
    db: Session,
    statut: StatutLivraison,
) -> None:
    """Un seul déclencheur, et les trois autres statuts le prouvent."""
    commande, livraison = _livraison_de(commandes, service, client, eclair.id_produit)
    if statut is StatutLivraison.EN_COURS:
        livreur = _salarie(db, FonctionPersonnel.LIVREUR)
        service.affecter_livreur(livraison.id_livraison, livreur.id_personnel)

    service.changer_statut(livraison.id_livraison, statut)

    assert commande.statut is StatutCommande.EN_ATTENTE


def test_la_synchronisation_ne_remonte_pas(
    commandes: CommandeService,
    service: LivraisonService,
    client: Client,
    eclair: Produit,
    db: Session,
) -> None:
    """Le sens est unique : une commande ne pilote pas sa tournée."""
    commande, livraison = _livraison_de(commandes, service, client, eclair.id_produit)

    commande.statut = StatutCommande.ANNULEE
    db.commit()

    assert livraison.statut is StatutLivraison.EN_ATTENTE


def test_sur_place_ne_peut_pas_atteindre_cette_propagation(
    commandes: CommandeService, client: Client, eclair: Produit
) -> None:
    """La branche `Servie` de `STATUT_TERMINAL` est inatteignable par ce chemin.

    Une commande sur place ne peut pas porter d'adresse, donc pas de livraison.
    La table est lue quand même, pour que la règle garde un seul endroit où
    vivre.
    """
    with pytest.raises(ReferenceInvalide):
        commandes.creer(
            _commande(eclair.id_produit, type_commande=TypeCommande.SUR_PLACE), client
        )


def test_le_statut_de_commande_n_est_ecrit_par_aucun_schema_d_entree() -> None:
    """Verrou de conception : la garantie est structurelle, pas conventionnelle.

    Si quelqu'un expose `statut` en entrée, un second chemin de transition
    apparaît et ce test tombe.
    """
    from app.schemas.commande import CommandeCreate, CommandeInviteCreate

    for schema in (CommandeCreate, CommandeInviteCreate):
        assert "statut" not in schema.model_fields
