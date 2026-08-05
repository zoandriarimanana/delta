"""Tests du service COMMANDE, contre PostgreSQL uniquement.

SQLite ne peut pas porter ces tests : `COMMANDE` référence `RESERVATION`, dont
le `CHECK` d'exclusivité utilise la syntaxe PostgreSQL `(colonne IS NOT NULL)::int`.
SQLite refuse la table (« unrecognized token: ":" »), et la clé étrangère est
résolue à l'insertion même lorsque la colonne est NULL.

Les contourner supposerait soit de créer `RESERVATION` sans sa contrainte, soit
de désactiver l'application des clés étrangères — dans les deux cas, ces tests ne
vérifieraient plus le schéma de production.

Chaque test s'exécute dans une transaction annulée à la sortie : rien n'est
laissé en base.
"""

from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.security import hacher_mot_de_passe
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.produit import Produit
from app.schemas.commande import CommandeCreate, CommandeInviteCreate
from app.schemas.demande_personnalisation import DemandePersonnalisationCreate
from app.schemas.ligne_commande import LigneCommandeCreate
from app.services.commande_service import CommandeService

pytestmark = pytest.mark.postgres


@pytest.fixture
def db(session_postgres: Session) -> Session:
    """Alias local : tous les tests de ce module passent par PostgreSQL."""
    return session_postgres


@pytest.fixture
def service(db: Session) -> CommandeService:
    return CommandeService(db)


@pytest.fixture
def client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=_email("jean"),
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


@pytest.fixture
def eclair(db: Session) -> Produit:
    categorie = CategorieProduit(libelle="Pâtisserie")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _email(prefixe: str) -> str:
    """Adresse unique : `uq_client_email` est partiel, mais reste actif."""
    return f"{prefixe}_{uuid4().hex[:8]}@example.mg"


def _commande(id_produit: int, quantite: int = 2) -> CommandeCreate:
    return CommandeCreate(
        type_commande=TypeCommande.EN_LIGNE,
        lignes=[LigneCommandeCreate(id_produit=id_produit, quantite=quantite)],
    )


# --- Création ----------------------------------------------------------------


def test_creation_ecrit_commande_et_lignes(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    commande = service.creer(_commande(eclair.id_produit), client)

    assert commande.id_commande is not None
    assert commande.id_client == client.id_client
    assert len(service.lignes.lister_par_commande(commande.id_commande)) == 1


def test_statut_initial_impose_par_le_serveur(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    """Le statut est un cycle de vie, pas une donnée d'entrée."""
    commande = service.creer(_commande(eclair.id_produit), client)

    assert commande.statut == StatutCommande.EN_ATTENTE


def test_prix_recopie_depuis_le_catalogue(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    commande = service.creer(_commande(eclair.id_produit), client)

    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]
    assert ligne.prix_unitaire_applique == eclair.prix_unitaire


def test_prix_fige_apres_evolution_du_catalogue(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Une hausse de tarif ne rétroagit pas sur les commandes passées."""
    commande = service.creer(_commande(eclair.id_produit), client)
    montant_initial = commande.montant_total

    eclair.prix_unitaire = Decimal("99.00")
    db.commit()

    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]
    assert ligne.prix_unitaire_applique == Decimal("3.50")
    assert commande.montant_total == montant_initial


def test_montant_total_calcule_par_le_serveur(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    autre = Produit(
        nom="Millefeuille",
        prix_unitaire=Decimal("5.00"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=eclair.id_categorie,
    )
    db.add(autre)
    db.commit()

    commande = service.creer(
        CommandeCreate(
            type_commande=TypeCommande.EN_LIGNE,
            lignes=[
                LigneCommandeCreate(id_produit=eclair.id_produit, quantite=2),
                LigneCommandeCreate(id_produit=autre.id_produit, quantite=3),
            ],
        ),
        client,
    )

    assert commande.montant_total == Decimal("22.00")  # 2×3.50 + 3×5.00


def test_montant_total_ne_peut_pas_venir_de_la_requete() -> None:
    """Le schema n'expose pas le champ : l'envoyer n'a aucun effet."""
    charge = CommandeCreate.model_validate(
        {
            "type_commande": "En_ligne",
            "montant_total": "0.01",
            "statut": "Livree",
            "lignes": [{"id_produit": 1, "quantite": 1}],
        }
    )

    assert not hasattr(charge, "montant_total")
    assert not hasattr(charge, "statut")


# --- Références invalides ----------------------------------------------------


def test_produit_inexistant_leve_reference_invalide(
    service: CommandeService, client: Client
) -> None:
    """422 : la référence est dans le corps, pas dans l'URL."""
    with pytest.raises(ReferenceInvalide):
        service.creer(_commande(99999), client)


def test_produit_archive_traite_comme_inexistant(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    service.produits.delete(eclair)
    db.commit()

    with pytest.raises(ReferenceInvalide):
        service.creer(_commande(eclair.id_produit), client)


def test_commande_sans_ligne_refusee() -> None:
    """Rejetée par le schema, avant d'atteindre le service."""
    with pytest.raises(ValueError):
        CommandeCreate(type_commande=TypeCommande.EN_LIGNE, lignes=[])


def test_quantite_nulle_ou_negative_refusee() -> None:
    for quantite in (0, -3):
        with pytest.raises(ValueError):
            LigneCommandeCreate(id_produit=1, quantite=quantite)


# --- Stock -------------------------------------------------------------------


def test_stock_decremente_a_la_creation(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    service.creer(_commande(eclair.id_produit, quantite=4), client)

    db.refresh(eclair)
    assert eclair.stock_disponible == 6


def test_stock_insuffisant_leve_conflit(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    """409, avec un message qui dit ce qui manque."""
    with pytest.raises(ConflitMetier) as capture:
        service.creer(_commande(eclair.id_produit, quantite=11), client)

    assert "Stock insuffisant" in str(capture.value)


def test_stock_exactement_suffisant_accepte(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """La borne est incluse : commander tout le stock restant doit passer."""
    service.creer(_commande(eclair.id_produit, quantite=10), client)

    db.refresh(eclair)
    assert eclair.stock_disponible == 0


def test_le_decrement_decide_sur_la_valeur_en_base(
    service: CommandeService, eclair: Produit, db: Session
) -> None:
    """Le cœur de la protection contre la concurrence.

    `decrementer_stock` doit trancher sur la valeur **en base**, pas sur celle
    que la session a en mémoire. On écrit le stock réel en SQL sans toucher à
    l'objet : celui-ci garde donc une valeur périmée et généreuse. Si le
    repository s'y fiait, il accepterait le retrait.

    Première version de ce test : elle modifiait l'attribut de l'objet pour le
    rendre périmé — ce qui salit l'objet, et SQLAlchemy l'**autoflush** avant
    d'exécuter l'UPDATE. La valeur « jamais écrite » l'était donc, et le test
    passait pour de mauvaises raisons.
    """
    db.execute(
        update(Produit)
        .where(Produit.id_produit == eclair.id_produit)
        .values(stock_disponible=2)
        .execution_options(synchronize_session=False)
    )
    assert eclair.stock_disponible == 10, "l'objet doit rester périmé en mémoire"

    accepte = service.produits.decrementer_stock(eclair.id_produit, 5)

    assert accepte is False
    db.refresh(eclair)
    assert eclair.stock_disponible == 2, "le stock réel ne doit pas avoir bougé"


def test_deux_decrements_concurrents_sur_le_dernier_article(
    service: CommandeService, eclair: Produit, db: Session
) -> None:
    """Deux commandes sur le dernier article : une seule peut réussir."""
    eclair.stock_disponible = 1
    db.commit()

    premier = service.produits.decrementer_stock(eclair.id_produit, 1)
    second = service.produits.decrementer_stock(eclair.id_produit, 1)

    assert (premier, second) == (True, False)
    db.refresh(eclair)
    assert eclair.stock_disponible == 0, "le stock ne devient jamais négatif"


# --- Archivage ---------------------------------------------------------------


def test_archivage_propage_aux_lignes(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Le CASCADE du schéma ne se déclenche pas sur un UPDATE."""
    commande = service.creer(_commande(eclair.id_produit), client)

    service.supprimer(commande.id_commande)

    assert commande.supprime_le is not None
    assert service.lignes.lister_par_commande(commande.id_commande) == []
    archivees = service.lignes.lister_par_commande(
        commande.id_commande, inclure_supprimes=True
    )
    assert len(archivees) == 1
    assert archivees[0].supprime_le is not None


def test_archivage_conserve_le_montant(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    """`montant_total` reste la trace de ce qui a été commandé."""
    commande = service.creer(_commande(eclair.id_produit), client)
    montant = commande.montant_total

    service.supprimer(commande.id_commande)

    assert commande.montant_total == montant


def test_commande_archivee_devient_introuvable(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    commande = service.creer(_commande(eclair.id_produit), client)
    service.supprimer(commande.id_commande)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(commande.id_commande)


# --- Historique --------------------------------------------------------------


def test_historique_isole_les_clients(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    autre = Client(
        type_client=TypeClient.PARTICULIER,
        email=_email("autre"),
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(autre)
    db.commit()
    service.creer(_commande(eclair.id_produit), client)
    service.creer(_commande(eclair.id_produit), autre)

    assert len(service.lister_du_client(client)) == 1
    assert len(service.lister_du_client(autre)) == 1


def test_historique_date_les_commandes(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    commande = service.creer(_commande(eclair.id_produit), client)

    assert commande.date_commande is not None
    # `TIMESTAMPTZ` : sans fuseau, deux serveurs configurés différemment
    # produiraient des instants incomparables.
    assert commande.date_commande.tzinfo is not None


def test_historique_trie_par_date_et_non_par_identifiant(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Le tri suit la chronologie, même quand elle contredit la séquence.

    Les insertions étant séquentielles, `id DESC` et `date DESC` coïncident en
    conditions normales : un test qui se contenterait de créer deux commandes
    passerait avec l'un comme avec l'autre, et ne prouverait rien. On force donc
    les deux ordres à diverger.
    """
    ancienne = service.creer(_commande(eclair.id_produit), client)
    recente = service.creer(_commande(eclair.id_produit), client)

    # La plus petite date est posée sur le plus grand identifiant : c'est
    # exactement ce qu'une reprise de données antérieures produirait.
    db.execute(
        update(Commande)
        .where(Commande.id_commande == recente.id_commande)
        .values(date_commande=text("now() - interval '2 days'"))
    )
    db.commit()

    historique = [c.id_commande for c in service.lister_du_client(client)]

    assert historique == [ancienne.id_commande, recente.id_commande]
    # Le tri par identifiant aurait donné l'ordre inverse.
    assert historique != sorted(historique, reverse=True)


# --- Parcours invité ----------------------------------------------------------


def _commande_invite(id_produit: int, quantite: int = 2) -> CommandeInviteCreate:
    return CommandeInviteCreate(
        type_commande=TypeCommande.A_EMPORTER,
        lignes=[LigneCommandeCreate(id_produit=id_produit, quantite=quantite)],
        nom_invite="Rakoto Jean",
        contact_invite="+261340000000",
    )


def test_commande_invitee_sans_client(
    service: CommandeService, eclair: Produit
) -> None:
    commande = service.creer_pour_invite(_commande_invite(eclair.id_produit))

    assert commande.id_client is None
    assert commande.nom_invite == "Rakoto Jean"
    assert commande.contact_invite == "+261340000000"


def test_reference_publique_generee_pour_un_invite(
    service: CommandeService, eclair: Produit
) -> None:
    """Seul moyen pour l'invité de revenir sur sa commande."""
    commande = service.creer_pour_invite(_commande_invite(eclair.id_produit))

    assert isinstance(commande.reference_publique, UUID)


def test_pas_de_reference_pour_un_client_identifie(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    """Un client retrouve ses commandes par son historique : rien à générer."""
    commande = service.creer(_commande(eclair.id_produit), client)

    assert commande.reference_publique is None


def test_deux_commandes_invitees_ont_des_references_distinctes(
    service: CommandeService, eclair: Produit
) -> None:
    premiere = service.creer_pour_invite(_commande_invite(eclair.id_produit, 1))
    seconde = service.creer_pour_invite(_commande_invite(eclair.id_produit, 1))

    assert premiere.reference_publique != seconde.reference_publique


def test_lecture_par_reference(service: CommandeService, eclair: Produit) -> None:
    commande = service.creer_pour_invite(_commande_invite(eclair.id_produit))

    relue = service.obtenir_par_reference(commande.reference_publique)

    assert relue.id_commande == commande.id_commande


def test_reference_inconnue_leve_ressource_introuvable(
    service: CommandeService,
) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir_par_reference(uuid4())


def test_commande_invitee_archivee_devient_introuvable(
    service: CommandeService, eclair: Produit
) -> None:
    """Une référence valide ne ressuscite pas une commande archivée."""
    commande = service.creer_pour_invite(_commande_invite(eclair.id_produit))
    reference = commande.reference_publique
    service.supprimer(commande.id_commande)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_par_reference(reference)


def test_commande_invitee_absente_de_tout_historique(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    """Sans `id_client`, elle ne peut apparaître dans aucun historique."""
    service.creer_pour_invite(_commande_invite(eclair.id_produit))

    assert service.lister_du_client(client) == []


def test_le_stock_est_decremente_aussi_pour_un_invite(
    service: CommandeService, eclair: Produit, db: Session
) -> None:
    service.creer_pour_invite(_commande_invite(eclair.id_produit, quantite=3))

    db.refresh(eclair)
    assert eclair.stock_disponible == 7


def test_contact_invite_obligatoire() -> None:
    """Le CHECK de la base ne porte que sur `nom_invite` ; le schema complète.

    Une commande sans moyen de recontacter l'acheteur n'a pas de sens, mais un
    CHECK à trois colonnes se lirait mal pour ce qu'il apporte.
    """
    with pytest.raises(ValueError):
        CommandeInviteCreate(
            type_commande=TypeCommande.A_EMPORTER,
            lignes=[LigneCommandeCreate(id_produit=1, quantite=1)],
            nom_invite="Rakoto",
        )


def test_le_check_refuse_une_commande_sans_commanditaire(
    service: CommandeService, eclair: Produit, db: Session
) -> None:
    """Garde-fou de la base, court-circuitant le service.

    Si la contrainte n'existait pas, une commande orpheline pourrait être écrite
    par tout chemin ne passant pas par le service — import SQL, script de seed.
    """
    with pytest.raises(IntegrityError):
        service.commandes.create(
            {
                "type_commande": TypeCommande.EN_LIGNE,
                "statut": StatutCommande.EN_ATTENTE,
                "montant_total": Decimal("0"),
            }
        )
    db.rollback()


def test_le_check_refuse_client_et_invite_a_la_fois(
    service: CommandeService, client: Client, db: Session
) -> None:
    with pytest.raises(IntegrityError):
        service.commandes.create(
            {
                "type_commande": TypeCommande.EN_LIGNE,
                "statut": StatutCommande.EN_ATTENTE,
                "montant_total": Decimal("0"),
                "id_client": client.id_client,
                "nom_invite": "Rakoto",
            }
        )
    db.rollback()


# --- Personnalisation ----------------------------------------------------------


@pytest.fixture
def gateau(db: Session, eclair: Produit) -> Produit:
    """Produit personnalisable, contrairement à l'éclair."""
    produit = Produit(
        nom="Gâteau d'anniversaire",
        prix_unitaire=Decimal("25.00"),
        unite_mesure="piece",
        stock_disponible=10,
        est_personnalisable=True,
        supplement_personnalisation=Decimal("4.00"),
        id_categorie=eclair.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _commande_personnalisee(id_produit: int, quantite: int = 1) -> CommandeCreate:
    return CommandeCreate(
        type_commande=TypeCommande.EN_LIGNE,
        lignes=[
            LigneCommandeCreate(
                id_produit=id_produit,
                quantite=quantite,
                personnalisation=DemandePersonnalisationCreate(
                    description_demande="Écrire « Joyeux anniversaire »",
                    ingredients_specifiques="Sans fruits à coque",
                ),
            )
        ],
    )


def test_personnalisation_creee_avec_la_ligne(
    service: CommandeService, client: Client, gateau: Produit
) -> None:
    commande = service.creer(_commande_personnalisee(gateau.id_produit), client)

    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]
    demande = service.personnalisations.get_by_ligne(ligne.id_ligne)
    assert demande is not None
    assert demande.ingredients_specifiques == "Sans fruits à coque"


def test_produit_non_personnalisable_refuse(
    service: CommandeService, client: Client, eclair: Produit
) -> None:
    """422 : le produit existe, c'est la combinaison envoyée qui est invalide.

    `est_personnalisable` est une propriété du catalogue, pas une préférence du
    client.
    """
    with pytest.raises(ReferenceInvalide):
        service.creer(_commande_personnalisee(eclair.id_produit), client)


def test_refus_n_ecrit_aucune_commande(
    service: CommandeService, client: Client, eclair: Produit, db: Session
) -> None:
    """Tout se joue dans une transaction : le refus ne laisse pas de commande
    orpheline, ni de stock réservé."""
    stock_initial = eclair.stock_disponible

    with pytest.raises(ReferenceInvalide):
        service.creer(_commande_personnalisee(eclair.id_produit), client)
    db.rollback()

    assert service.lister_du_client(client) == []
    db.refresh(eclair)
    assert eclair.stock_disponible == stock_initial


def test_ligne_sans_personnalisation_n_en_cree_aucune(
    service: CommandeService, client: Client, gateau: Produit
) -> None:
    """Un produit personnalisable n'oblige à rien."""
    commande = service.creer(_commande(gateau.id_produit), client)

    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]
    assert service.personnalisations.get_by_ligne(ligne.id_ligne) is None


def test_id_produit_base_deduit_de_la_ligne(
    service: CommandeService, client: Client, gateau: Produit
) -> None:
    """Non saisi, donc jamais incohérent avec le produit commandé."""
    commande = service.creer(_commande_personnalisee(gateau.id_produit), client)

    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]
    demande = service.personnalisations.get_by_ligne(ligne.id_ligne)
    assert demande is not None
    assert demande.id_produit_base == gateau.id_produit


def test_supplement_ne_vient_pas_de_la_requete() -> None:
    """Le schema ne porte pas le champ : l'envoyer n'a aucun effet.

    L'accepter laisserait le client fixer ce qu'il paie — il suffirait
    d'envoyer `0` pour obtenir une personnalisation gratuite.
    """
    charge = DemandePersonnalisationCreate.model_validate(
        {"description_demande": "Sans sucre", "supplement_prix": "0.00"}
    )

    assert not hasattr(charge, "supplement_prix")


def test_supplement_lu_sur_le_produit_commande(
    service: CommandeService, client: Client, gateau: Produit
) -> None:
    """Le montant vient du catalogue, pas d'une valeur inventée par le service.

    Le tarif du gâteau est 4.00 et son prix 25.00 : le total doit être 29.00.
    Une valeur de test arbitraire ne prouverait rien — c'est bien
    `PRODUIT.supplement_personnalisation` qui doit être appliqué.
    """
    commande = service.creer(_commande_personnalisee(gateau.id_produit), client)

    assert gateau.supplement_personnalisation == Decimal("4.00")
    assert commande.montant_total == Decimal("29.00")  # 25.00 + 4.00


def test_deux_produits_ont_des_supplements_distincts(
    service: CommandeService, client: Client, gateau: Produit, db: Session
) -> None:
    """Le tarif varie **par produit** : c'est tout l'intérêt de la colonne.

    Un supplément global aurait donné le même montant pour les deux.
    """
    macaron = Produit(
        nom="Macaron personnalisé",
        prix_unitaire=Decimal("10.00"),
        unite_mesure="piece",
        stock_disponible=10,
        est_personnalisable=True,
        supplement_personnalisation=Decimal("1.50"),
        id_categorie=gateau.id_categorie,
    )
    db.add(macaron)
    db.commit()

    total_gateau = service.creer(
        _commande_personnalisee(gateau.id_produit), client
    ).montant_total
    total_macaron = service.creer(
        _commande_personnalisee(macaron.id_produit), client
    ).montant_total

    assert total_gateau == Decimal("29.00")  # 25.00 + 4.00
    assert total_macaron == Decimal("11.50")  # 10.00 + 1.50


def test_supplement_applique_par_unite(
    service: CommandeService, client: Client, gateau: Produit
) -> None:
    """Personnaliser trois gâteaux, c'est trois fois le travail.

    Le tarif est par unité, comme `prix_unitaire` dont il est le voisin.
    """
    commande = service.creer(
        _commande_personnalisee(gateau.id_produit, quantite=3), client
    )

    assert commande.montant_total == Decimal("87.00")  # 3 × (25.00 + 4.00)


def test_supplement_fige_apres_evolution_du_catalogue(
    service: CommandeService, client: Client, gateau: Produit, db: Session
) -> None:
    """Même règle que `prix_unitaire_applique` : le tarif est recopié, pas lu."""
    commande = service.creer(_commande_personnalisee(gateau.id_produit), client)

    gateau.supplement_personnalisation = Decimal("99.00")
    db.commit()

    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]
    demande = service.personnalisations.get_by_ligne(ligne.id_ligne)
    assert demande is not None
    assert demande.supplement_prix == Decimal("4.00")
    assert commande.montant_total == Decimal("29.00")


def test_archivage_propage_a_la_personnalisation(
    service: CommandeService, client: Client, gateau: Produit
) -> None:
    """Deux niveaux de propagation, pas un seul.

    Le schéma prévoit `ON DELETE CASCADE` de `DEMANDE_PERSONNALISATION` vers
    `LIGNE_COMMANDE`, mais un archivage est un `UPDATE` : la cascade ne se
    déclenche pas.
    """
    commande = service.creer(_commande_personnalisee(gateau.id_produit), client)
    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]

    service.supprimer(commande.id_commande)

    assert service.personnalisations.get_by_ligne(ligne.id_ligne) is None
    archivee = service.personnalisations.get_by_ligne(
        ligne.id_ligne, inclure_supprimes=True
    )
    assert archivee is not None
    assert archivee.supprime_le is not None


def test_une_seule_demande_par_ligne(
    service: CommandeService, client: Client, gateau: Produit, db: Session
) -> None:
    """`UNIQUE (id_ligne)` est une cardinalité (1,1), et elle est **globale**.

    Rendue partielle, la table pourrait porter cinq demandes archivées et une
    active pour la même ligne.
    """
    commande = service.creer(_commande_personnalisee(gateau.id_produit), client)
    ligne = service.lignes.lister_par_commande(commande.id_commande)[0]

    with pytest.raises(IntegrityError):
        service.personnalisations.create(
            {
                "id_ligne": ligne.id_ligne,
                "id_produit_base": gateau.id_produit,
                "description_demande": "Une seconde demande",
                "supplement_prix": Decimal("0"),
            }
        )
        db.commit()
    db.rollback()
