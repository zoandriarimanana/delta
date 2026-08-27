"""Tests du service RESERVATION, contre PostgreSQL uniquement.

SQLite ne peut pas porter ces tests : le `CHECK` d'exclusivité de `RESERVATION`
utilise la syntaxe PostgreSQL `(colonne IS NOT NULL)::int`, que SQLite refuse
(« unrecognized token: ":" »).

Le cœur du module est `test_cycle_complet_la_place_revient_en_circulation` : deux
tests séparés ne prouveraient pas que la place est réellement rendue.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

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
from app.models.client import Client, TypeClient
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.logement import Logement, StatutLogement
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.models.salle import Salle
from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.schemas.reservation import ReservationCreate
from app.services.reservation_service import ReservationService

pytestmark = pytest.mark.postgres

DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(days=4)


@pytest.fixture
def db(session_postgres: Session) -> Session:
    """Alias local : tous les tests de ce module passent par PostgreSQL."""
    return session_postgres


@pytest.fixture
def service(db: Session) -> ReservationService:
    return ReservationService(db)


def _client(db: Session, prefixe: str = "jean") -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"{prefixe}_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


@pytest.fixture
def client(db: Session) -> Client:
    return _client(db)


def _session_ouverte(db: Session, capacite: int = 12) -> SessionFormation:
    """Session prête à recevoir des réservations."""
    domaine = DomaineFormation(libelle=f"Domaine {uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    formation = Formation(
        titre="CAP Pâtissier",
        duree_heures=140,
        prix=Decimal("850000.00"),
        capacite_max=capacite,
        id_domaine=domaine.id_domaine,
    )
    db.add(formation)
    db.flush()
    formateur = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=FonctionPersonnel.FORMATEUR,
        email=f"formateur_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(formateur)
    db.flush()
    session = SessionFormation(
        date_debut=DEBUT.date(),
        date_fin=FIN.date(),
        places_restantes=capacite,
        statut=StatutSessionFormation.OUVERTE,
        id_formation=formation.id_formation,
        id_formateur=formateur.id_personnel,
    )
    db.add(session)
    db.commit()
    return session


@pytest.fixture
def session_ouverte(db: Session) -> SessionFormation:
    return _session_ouverte(db)


def _donnees(id_session: int, nombre: int = 1) -> ReservationCreate:
    return ReservationCreate(
        type_reservation=TypeReservation.FORMATION,
        date_debut=DEBUT,
        date_fin=FIN,
        nombre_personnes=nombre,
        id_session=id_session,
    )


# --- Création et décrément ----------------------------------------------------


def test_creation_decremente_les_places(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    service.creer(_donnees(session_ouverte.id_session, nombre=3), client)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 9


def test_statut_initial_impose_par_le_serveur(
    service: ReservationService, client: Client, session_ouverte: SessionFormation
) -> None:
    reservation = service.creer(_donnees(session_ouverte.id_session), client)

    assert reservation.statut is StatutReservation.EN_ATTENTE


def test_statut_ne_peut_pas_venir_de_la_requete() -> None:
    """Le schema n'expose pas le champ : l'envoyer n'a aucun effet."""
    charge = ReservationCreate.model_validate(
        {
            "type_reservation": "Formation",
            "date_debut": DEBUT.isoformat(),
            "date_fin": FIN.isoformat(),
            "id_session": 1,
            "statut": "Honoree",
            "id_client": 999,
        }
    )

    assert not hasattr(charge, "statut")
    assert not hasattr(charge, "id_client")


def test_places_insuffisantes_leve_un_conflit(
    service: ReservationService, client: Client, db: Session
) -> None:
    """409, avec un message qui dit ce qui reste."""
    session = _session_ouverte(db, capacite=2)

    with pytest.raises(ConflitMetier) as capture:
        service.creer(_donnees(session.id_session, nombre=3), client)

    assert "2" in str(capture.value)


def test_refus_n_ecrit_aucune_reservation(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Le décrément précède l'insertion : rien n'est écrit s'il échoue."""
    session = _session_ouverte(db, capacite=1)

    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session.id_session, nombre=5), client)

    assert service.lister_du_client(client) == []
    db.refresh(session)
    assert session.places_restantes == 1


def test_session_inexistante_leve_reference_invalide(
    service: ReservationService, client: Client
) -> None:
    """422 : la référence est dans le corps, pas dans l'URL."""
    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(99999), client)


@pytest.mark.parametrize(
    "statut",
    [
        StatutSessionFormation.PLANIFIEE,
        StatutSessionFormation.TERMINEE,
        StatutSessionFormation.ANNULEE,
    ],
)
def test_session_non_ouverte_refusee(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
    statut: StatutSessionFormation,
) -> None:
    """Seule une session `Ouverte` accepte des réservations."""
    session_ouverte.statut = statut
    db.commit()

    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session_ouverte.id_session), client)


def test_formation_sans_session_refusee_par_le_schema() -> None:
    """Le `CHECK` d'exclusivité autorise zéro cible — c'est la règle du type
    Formation qui l'exige, et elle croise deux colonnes."""
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=TypeReservation.FORMATION,
            date_debut=DEBUT,
            date_fin=FIN,
        )


def test_dates_inversees_refusees() -> None:
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=TypeReservation.FORMATION,
            date_debut=FIN,
            date_fin=DEBUT,
            id_session=1,
        )


@pytest.mark.parametrize(
    "type_reservation", [TypeReservation.SALLE, TypeReservation.LOGEMENT]
)
def test_type_sans_sa_cible_refuse(type_reservation: TypeReservation) -> None:
    """Le refus a changé de raison en #47, et le test avec.

    Jusqu'à #46, `Salle` et `Logement` étaient refusés parce qu'aucun service ne
    savait les honorer. Ils sont désormais acceptés — mais chaque type doit
    désigner **sa** cible, et le `CHECK` d'exclusivité ne peut pas l'imposer :
    il autorise zéro colonne renseignée.
    """
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=type_reservation,
            date_debut=DEBUT,
            date_fin=FIN,
        )


# --- Restitution --------------------------------------------------------------


def test_annulation_restitue_la_place(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    reservation = service.creer(_donnees(session_ouverte.id_session, nombre=2), client)
    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 10

    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


def test_la_restitution_est_idempotente(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Annuler deux fois ne crédite pas deux fois.

    Sans cette garde, chaque appel répété gonflerait le compteur et la session
    finirait par afficher plus de places qu'elle n'en a.
    """
    reservation = service.creer(_donnees(session_ouverte.id_session), client)
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    # Rejouer la même transition est sans effet.
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


def test_une_reservation_annulee_ne_change_plus_de_statut(
    service: ReservationService, client: Client, session_ouverte: SessionFormation
) -> None:
    """Le permettre supposerait de re-décrémenter, donc de pouvoir échouer faute
    de places — une transition de statut qui échoue par capacité serait un
    piège."""
    reservation = service.creer(_donnees(session_ouverte.id_session), client)
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    with pytest.raises(ConflitMetier):
        service.changer_statut(reservation.id_reservation, StatutReservation.CONFIRMEE)


def test_honorer_ne_restitue_pas(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Un stagiaire venu a consommé sa place.

    La rendre ferait réapparaître de la disponibilité qui n'existe pas.
    """
    reservation = service.creer(_donnees(session_ouverte.id_session), client)

    service.changer_statut(reservation.id_reservation, StatutReservation.HONOREE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 11


def test_confirmer_ne_change_pas_le_compteur(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """La place était déjà retenue dès la création."""
    reservation = service.creer(_donnees(session_ouverte.id_session), client)

    service.changer_statut(reservation.id_reservation, StatutReservation.CONFIRMEE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 11


def test_archivage_restitue_aussi(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Une réservation archivée ne doit plus immobiliser de place.

    Ne pas restituer ici laisserait le même trou que l'annulation évite, par un
    autre chemin.
    """
    reservation = service.creer(_donnees(session_ouverte.id_session, nombre=4), client)

    service.supprimer(reservation.id_reservation)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


def test_archiver_une_annulee_ne_credite_pas_deux_fois(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    reservation = service.creer(_donnees(session_ouverte.id_session), client)
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    service.supprimer(reservation.id_reservation)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


# --- Le test qui prouve quelque chose -----------------------------------------


def test_cycle_complet_la_place_revient_en_circulation(
    service: ReservationService, db: Session
) -> None:
    """Le cœur de l'issue, en un seul test.

    Un client prend la dernière place, un tiers se voit refuser, le premier
    annule, le tiers réussit. Deux tests séparés — « l'annulation crédite » et
    « la réservation décrémente » — passeraient tous les deux sans prouver que
    la place est **réellement revenue en circulation**.
    """
    session = _session_ouverte(db, capacite=1)
    premier = _client(db, "premier")
    tiers = _client(db, "tiers")

    service.creer(_donnees(session.id_session), premier)
    db.refresh(session)
    assert session.places_restantes == 0

    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session.id_session), tiers)

    reservation = service.lister_du_client(premier)[0]
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)
    db.refresh(session)
    assert session.places_restantes == 1

    reussie = service.creer(_donnees(session.id_session), tiers)

    assert reussie.id_client == tiers.id_client
    db.refresh(session)
    assert session.places_restantes == 0


def test_deux_decrements_concurrents_sur_la_derniere_place(
    service: ReservationService, db: Session
) -> None:
    """C'est PostgreSQL qui arbitre, pas l'application.

    La valeur est remise à 1 **par SQL**, sans toucher l'objet en session :
    modifier l'attribut le rendrait « sale » et déclencherait un autoflush avant
    l'`UPDATE` conditionnel, ce qui fausserait la mesure. Même précaution que
    dans `test_commande_service.py`.
    """
    session = _session_ouverte(db, capacite=1)
    premier = _client(db, "premier")
    second = _client(db, "second")

    assert service.sessions.decrementer_places(session.id_session, 1) is True
    assert service.sessions.decrementer_places(session.id_session, 1) is False

    db.execute(
        update(SessionFormation)
        .where(SessionFormation.id_session == session.id_session)
        .values(places_restantes=1)
        .execution_options(synchronize_session=False)
    )
    db.commit()

    service.creer(_donnees(session.id_session), premier)
    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session.id_session), second)

    reste = db.execute(
        text("SELECT places_restantes FROM session_formation WHERE id_session = :i"),
        {"i": session.id_session},
    ).scalar()
    assert reste == 0


# --- Isolation entre clients --------------------------------------------------


def test_la_reservation_d_autrui_est_introuvable(
    service: ReservationService, session_ouverte: SessionFormation, db: Session
) -> None:
    """404 et non 403 : confirmer son existence renseignerait déjà."""
    proprietaire = _client(db, "proprietaire")
    autre = _client(db, "autre")
    reservation = service.creer(_donnees(session_ouverte.id_session), proprietaire)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_du_client(reservation.id_reservation, autre)


def test_historique_isole_les_clients(
    service: ReservationService, session_ouverte: SessionFormation, db: Session
) -> None:
    premier = _client(db, "premier")
    second = _client(db, "second")
    service.creer(_donnees(session_ouverte.id_session), premier)
    service.creer(_donnees(session_ouverte.id_session), second)

    assert len(service.lister_du_client(premier)) == 1
    assert len(service.lister_du_client(second)) == 1


# --- Option hébergement -------------------------------------------------------


def _session_avec_hebergement(db: Session, propose: bool) -> SessionFormation:
    """Session dont la formation propose — ou non — l'hébergement."""
    domaine = DomaineFormation(libelle=f"Domaine {uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    formation = Formation(
        titre="CAP Pâtissier",
        duree_heures=140,
        prix=Decimal("850000.00"),
        capacite_max=12,
        propose_hebergement=propose,
        id_domaine=domaine.id_domaine,
    )
    db.add(formation)
    db.flush()
    formateur = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=FonctionPersonnel.FORMATEUR,
        email=f"formateur_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(formateur)
    db.flush()
    session = SessionFormation(
        date_debut=DEBUT.date(),
        date_fin=FIN.date(),
        places_restantes=12,
        statut=StatutSessionFormation.OUVERTE,
        id_formation=formation.id_formation,
        id_formateur=formateur.id_personnel,
    )
    db.add(session)
    db.commit()
    return session


def _avec_hebergement(id_session: int) -> ReservationCreate:
    return ReservationCreate(
        type_reservation=TypeReservation.FORMATION,
        date_debut=DEBUT,
        date_fin=FIN,
        id_session=id_session,
        avec_hebergement=True,
    )


def test_hebergement_accepte_si_la_formation_le_propose(
    service: ReservationService, client: Client, db: Session
) -> None:
    session = _session_avec_hebergement(db, propose=True)

    reservation = service.creer(_avec_hebergement(session.id_session), client)

    assert reservation.avec_hebergement is True


def test_hebergement_refuse_si_la_formation_ne_le_propose_pas(
    service: ReservationService, client: Client, db: Session
) -> None:
    """422 : propriété du catalogue, pas préférence du client.

    Une formation d'une journée sur place ne loge personne parce qu'on le
    demande — même raisonnement que `PRODUIT.est_personnalisable`.
    """
    session = _session_avec_hebergement(db, propose=False)

    with pytest.raises(ReferenceInvalide) as capture:
        service.creer(_avec_hebergement(session.id_session), client)

    assert "hébergement" in str(capture.value)


def test_le_refus_ne_consomme_aucune_place(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La vérification précède le décrément : rien n'est immobilisé pour rien."""
    session = _session_avec_hebergement(db, propose=False)

    with pytest.raises(ReferenceInvalide):
        service.creer(_avec_hebergement(session.id_session), client)

    db.refresh(session)
    assert session.places_restantes == 12


def test_sans_hebergement_la_formation_qui_ne_le_propose_pas_reste_reservable(
    service: ReservationService, client: Client, db: Session
) -> None:
    """L'option est facultative : son absence n'empêche rien."""
    session = _session_avec_hebergement(db, propose=False)

    reservation = service.creer(_donnees(session.id_session), client)

    assert reservation.avec_hebergement is False


@pytest.mark.parametrize("type_reservation", [TypeReservation.TABLE])
def test_hebergement_refuse_hors_formation(
    type_reservation: TypeReservation,
) -> None:
    """Un hébergement lié à une table n'aurait rien pour le valider."""
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=type_reservation,
            date_debut=DEBUT,
            date_fin=FIN,
            avec_hebergement=True,
        )


# --- Couplage formation <-> logement (#62) ------------------------------------
#
# Ces tests remplacent `test_aucun_logement_n_est_reserve`, qui figeait l'état
# antérieur — « le drapeau dit un souhait, pas une attribution » — et portait
# dans sa docstring l'instruction de le reprendre le jour où le couplage
# arriverait. Ce jour est celui-ci : le test n'est pas affaibli, il est remplacé
# par son successeur, qui vérifie le comportement inverse.
#
# **Capacité distinctive.** La base de développement porte d'autres logements,
# et `premier_libre` retient le plus petit identifiant : sans discriminant, les
# tests dépendraient de données qu'ils ne créent pas. Une capacité que rien
# d'autre n'atteint isole la chambre de sonde sans toucher au reste.

CAPACITE_SONDE = 97


def _chambre(db: Session, capacite: int = CAPACITE_SONDE) -> Logement:
    """Chambre libre, dotée d'une capacité qu'aucune autre n'atteint."""
    logement = Logement(
        type_chambre=f"Sonde {uuid4().hex[:6]}",
        capacite=capacite,
        tarif_nuitee=Decimal("80000.00"),
        statut=StatutLogement.DISPONIBLE,
    )
    db.add(logement)
    db.commit()
    return logement


def _session_logeable(db: Session) -> SessionFormation:
    """Session dont la formation propose l'hébergement, assez large pour la
    sonde."""
    session = _session_avec_hebergement(db, propose=True)
    db.execute(
        update(SessionFormation)
        .where(SessionFormation.id_session == session.id_session)
        .values(places_restantes=CAPACITE_SONDE + 1)
    )
    db.commit()
    db.refresh(session)
    return session


def _demande_logeable(id_session: int) -> ReservationCreate:
    return ReservationCreate(
        type_reservation=TypeReservation.FORMATION,
        date_debut=DEBUT,
        date_fin=FIN,
        nombre_personnes=CAPACITE_SONDE,
        id_session=id_session,
        avec_hebergement=True,
    )


def test_une_chambre_libre_cree_une_seconde_reservation_liee(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Le couplage passe par **deux lignes**, jamais par une seule.

    Le `CHECK` d'exclusivité interdit qu'une même ligne porte `#id_session` et
    `#id_logement` : c'est ce qui impose la seconde ligne.
    """
    chambre = _chambre(db)
    session = _session_logeable(db)

    formation = service.creer(_demande_logeable(session.id_session), client)

    assert formation.id_reservation_hebergement is not None
    hebergement = service.obtenir(formation.id_reservation_hebergement)
    assert hebergement.type_reservation is TypeReservation.LOGEMENT
    assert hebergement.id_logement == chambre.id_logement
    assert hebergement.id_client == client.id_client
    # Les dates sont celles de la session : le décalage d'une nuit est une
    # évolution future, pas une règle que quelqu'un ait énoncée.
    assert hebergement.date_debut == formation.date_debut
    assert hebergement.date_fin == formation.date_fin
    # La ligne d'hébergement ne porte pas le drapeau : il dit un souhait exprimé
    # sur une formation, et se lirait ici comme une récursion.
    assert hebergement.avec_hebergement is False


def test_sans_chambre_libre_la_formation_est_acceptee_quand_meme(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Aucune chambre libre n'est **pas** une erreur.

    Refuser trancherait à la place de l'administrateur, et obligerait à rendre
    la place tout juste décrémentée — défaire une écriture réussie pour cause
    d'échec d'une écriture accessoire. Même raisonnement que
    `LIVRAISON.Echouee` en #25.
    """
    session = _session_logeable(db)
    # Aucune chambre de cette capacité n'existe : `premier_libre` ne peut rien
    # retenir.

    formation = service.creer(_demande_logeable(session.id_session), client)

    assert formation.id_reservation_hebergement is None
    # Le souhait reste inscrit : c'est ce qui permet à un administrateur de
    # savoir qu'il y a un suivi à faire.
    assert formation.avec_hebergement is True
    db.refresh(session)
    assert session.places_restantes == 1


def test_une_chambre_deja_prise_sur_le_creneau_n_est_pas_reattribuee(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La seule chambre assez grande est occupée : le souhait reste non honoré."""
    chambre = _chambre(db)
    premier = _client(db, "premier")
    service.creer(
        ReservationCreate(
            type_reservation=TypeReservation.LOGEMENT,
            date_debut=DEBUT,
            date_fin=FIN,
            nombre_personnes=1,
            id_logement=chambre.id_logement,
        ),
        premier,
    )
    session = _session_logeable(db)

    formation = service.creer(_demande_logeable(session.id_session), client)

    assert formation.id_reservation_hebergement is None


def test_une_chambre_en_maintenance_n_est_jamais_retenue(
    service: ReservationService, client: Client, db: Session
) -> None:
    """`En_maintenance` dit que le bien n'est pas louable, quelle que soit la
    date."""
    chambre = _chambre(db)
    chambre.statut = StatutLogement.EN_MAINTENANCE
    db.commit()
    session = _session_logeable(db)

    formation = service.creer(_demande_logeable(session.id_session), client)

    assert formation.id_reservation_hebergement is None


def test_sans_hebergement_aucune_seconde_ligne(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Contrôle positif : sans lui, une implémentation qui n'attache jamais
    rien passerait les trois tests de refus ci-dessus."""
    _chambre(db)
    session = _session_logeable(db)

    formation = service.creer(
        ReservationCreate(
            type_reservation=TypeReservation.FORMATION,
            date_debut=DEBUT,
            date_fin=FIN,
            nombre_personnes=CAPACITE_SONDE,
            id_session=session.id_session,
        ),
        client,
    )

    assert formation.avec_hebergement is False
    assert formation.id_reservation_hebergement is None
    assert len(service.lister_du_client(client)) == 1


def test_annuler_la_formation_annule_l_hebergement(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Laisser une chambre retenue pour une formation annulée immobiliserait
    une ressource sans raison active."""
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    id_hebergement = formation.id_reservation_hebergement
    assert id_hebergement is not None

    service.changer_statut(formation.id_reservation, StatutReservation.ANNULEE)

    hebergement = service.obtenir(id_hebergement)
    assert hebergement.statut is StatutReservation.ANNULEE


def test_le_creneau_est_libere_par_l_annulation(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La chambre redevient attribuable : sans quoi chaque annulation
    condamnerait un créneau définitivement."""
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    service.changer_statut(formation.id_reservation, StatutReservation.ANNULEE)

    seconde_session = _session_logeable(db)
    seconde = service.creer(_demande_logeable(seconde_session.id_session), client)

    assert seconde.id_reservation_hebergement is not None


def test_annuler_l_hebergement_seul_ne_touche_pas_la_formation(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La propagation est **unidirectionnelle**.

    Un stagiaire qui se loge ailleurs garde sa formation — même forme que la
    synchronisation `LIVRAISON -> COMMANDE`, où rien ne remonte non plus.
    """
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    assert formation.id_reservation_hebergement is not None

    service.changer_statut(
        formation.id_reservation_hebergement, StatutReservation.ANNULEE
    )

    db.refresh(formation)
    assert formation.statut is StatutReservation.EN_ATTENTE


def test_annulation_rejouee_ne_produit_aucun_effet_supplementaire(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Idempotence, comme la restitution des places."""
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    id_hebergement = formation.id_reservation_hebergement
    assert id_hebergement is not None
    service.changer_statut(formation.id_reservation, StatutReservation.ANNULEE)
    db.refresh(session)
    places = session.places_restantes

    service.changer_statut(formation.id_reservation, StatutReservation.ANNULEE)

    db.refresh(session)
    assert session.places_restantes == places
    assert service.obtenir(id_hebergement).statut is StatutReservation.ANNULEE


def test_archiver_la_formation_archive_l_hebergement(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Un archivage est un `UPDATE` : aucun `CASCADE` ne se déclenche, la
    propagation revient au service."""
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    id_hebergement = formation.id_reservation_hebergement
    assert id_hebergement is not None

    service.supprimer(formation.id_reservation)

    archive = service.reservations.get_by_id(id_hebergement, inclure_supprimes=True)
    assert archive is not None
    assert archive.supprime_le is not None


def test_un_hebergement_ne_peut_pas_etre_partage_par_deux_formations(
    service: ReservationService, client: Client, db: Session
) -> None:
    """`UNIQUE` globale : une réservation d'hébergement appartient à au plus
    une formation.

    Elle exprime une propriété structurelle et non une identité métier — d'où
    une contrainte globale et non un index partiel, même raisonnement que
    `LIVRAISON.#id_commande`.
    """
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    seconde_session = _session_logeable(db)
    seconde = service.creer(
        ReservationCreate(
            type_reservation=TypeReservation.FORMATION,
            date_debut=DEBUT,
            date_fin=FIN,
            nombre_personnes=CAPACITE_SONDE,
            id_session=seconde_session.id_session,
        ),
        client,
    )

    seconde.id_reservation_hebergement = formation.id_reservation_hebergement
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_seule_une_formation_porte_un_hebergement_lie(
    service: ReservationService, client: Client, db: Session
) -> None:
    """`CHECK` en base : un lien sur une réservation de salle n'aurait aucun
    sens interprétable."""
    _chambre(db)
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)
    salle = _salle(db)
    reservation_salle = service.creer(
        ReservationCreate(
            type_reservation=TypeReservation.SALLE,
            date_debut=DEBUT,
            date_fin=FIN,
            nombre_personnes=1,
            id_salle=salle.id_salle,
        ),
        client,
    )

    reservation_salle.id_reservation_hebergement = formation.id_reservation_hebergement
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_une_reservation_ne_se_lie_pas_a_elle_meme(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La boucle n'a aucun sens métier, et toute propagation la suivrait
    indéfiniment."""
    session = _session_logeable(db)
    formation = service.creer(_demande_logeable(session.id_session), client)

    formation.id_reservation_hebergement = formation.id_reservation
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


# --- Salles et logements : le chevauchement -----------------------------------


def _salle(db: Session, capacite: int = 20) -> Salle:
    salle = Salle(
        nom=f"Salle {uuid4().hex[:6]}",
        capacite=capacite,
        tarif_horaire=Decimal("15000.00"),
    )
    db.add(salle)
    db.commit()
    return salle


def _logement(
    db: Session, statut: StatutLogement = StatutLogement.DISPONIBLE
) -> Logement:
    logement = Logement(
        type_chambre="Double",
        capacite=2,
        tarif_nuitee=Decimal("45000.00"),
        statut=statut,
    )
    db.add(logement)
    db.commit()
    return logement


def _creneau(
    id_salle: int, debut: datetime, fin: datetime, nombre: int = 1
) -> ReservationCreate:
    return ReservationCreate(
        type_reservation=TypeReservation.SALLE,
        date_debut=debut,
        date_fin=fin,
        nombre_personnes=nombre,
        id_salle=id_salle,
    )


# Créneau de référence : 1er septembre, 9 h → 12 h.
REF_DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
REF_FIN = datetime(2026, 9, 1, 12, 0, tzinfo=UTC)


def _creneau_logement(id_logement: int, nombre: int = 1) -> ReservationCreate:
    return ReservationCreate(
        type_reservation=TypeReservation.LOGEMENT,
        date_debut=REF_DEBUT,
        date_fin=REF_FIN,
        nombre_personnes=nombre,
        id_logement=id_logement,
    )


def test_reservation_de_salle(
    service: ReservationService, client: Client, db: Session
) -> None:
    salle = _salle(db)

    reservation = service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    assert reservation.id_salle == salle.id_salle
    assert reservation.statut is StatutReservation.EN_ATTENTE


@pytest.mark.parametrize(
    ("cas", "debut", "fin"),
    [
        (
            "commence avant, finit dedans",
            REF_DEBUT - timedelta(hours=2),
            REF_DEBUT + timedelta(hours=1),
        ),
        (
            "commence dedans, finit apres",
            REF_DEBUT + timedelta(hours=1),
            REF_FIN + timedelta(hours=2),
        ),
        (
            "strictement inclus",
            REF_DEBUT + timedelta(minutes=30),
            REF_FIN - timedelta(minutes=30),
        ),
        (
            "contient l'existante",
            REF_DEBUT - timedelta(hours=1),
            REF_FIN + timedelta(hours=1),
        ),
        ("identique", REF_DEBUT, REF_FIN),
    ],
)
def test_les_cinq_formes_de_chevauchement_sont_refusees(
    service: ReservationService,
    client: Client,
    db: Session,
    cas: str,
    debut: datetime,
    fin: datetime,
) -> None:
    """Un test d'inclusion seul manquerait quatre cas sur cinq."""
    salle = _salle(db)
    service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    with pytest.raises(ConflitMetier):
        service.creer(_creneau(salle.id_salle, debut, fin), client)


@pytest.mark.parametrize(
    ("cas", "debut", "fin"),
    [
        ("adjacent apres", REF_FIN, REF_FIN + timedelta(hours=2)),
        ("adjacent avant", REF_DEBUT - timedelta(hours=2), REF_DEBUT),
        ("disjoint", REF_FIN + timedelta(days=1), REF_FIN + timedelta(days=1, hours=2)),
    ],
)
def test_les_creneaux_sans_recouvrement_passent(
    service: ReservationService,
    client: Client,
    db: Session,
    cas: str,
    debut: datetime,
    fin: datetime,
) -> None:
    """Bornes `[)` : une salle libérée à midi est réservable à midi.

    Le contraire obligerait à laisser un trou artificiel entre deux locations.
    """
    salle = _salle(db)
    service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    seconde = service.creer(_creneau(salle.id_salle, debut, fin), client)

    assert seconde.id_reservation is not None


def test_meme_creneau_sur_deux_salles_differentes(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La contrainte porte sur le couple (bien, période), pas sur la période."""
    premiere = _salle(db)
    seconde = _salle(db)
    service.creer(_creneau(premiere.id_salle, REF_DEBUT, REF_FIN), client)

    autre = service.creer(_creneau(seconde.id_salle, REF_DEBUT, REF_FIN), client)

    assert autre.id_salle == seconde.id_salle


def test_une_reservation_annulee_libere_le_creneau(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Sans ce prédicat, une annulation condamnerait le créneau à jamais.

    Même raisonnement que la restitution des places d'une session en #41.
    """
    salle = _salle(db)
    premiere = service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    with pytest.raises(ConflitMetier):
        service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    service.changer_statut(premiere.id_reservation, StatutReservation.ANNULEE)
    seconde = service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    assert seconde.id_reservation != premiere.id_reservation


def test_une_reservation_archivee_libere_le_creneau(
    service: ReservationService, client: Client, db: Session
) -> None:
    salle = _salle(db)
    premiere = service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)
    service.supprimer(premiere.id_reservation)

    seconde = service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    assert seconde.id_reservation != premiere.id_reservation


def test_la_contrainte_tient_hors_service(
    service: ReservationService, client: Client, db: Session
) -> None:
    """La garantie réelle est en base, pas dans le pré-contrôle.

    On insère directement, en contournant `ReservationService` : c'est ce que
    ferait une reprise de données, ou deux requêtes simultanées passées toutes
    deux par le pré-contrôle.
    """
    salle = _salle(db)
    service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    with pytest.raises(IntegrityError) as capture:
        db.add(
            Reservation(
                type_reservation=TypeReservation.SALLE,
                date_debut=REF_DEBUT,
                date_fin=REF_FIN,
                nombre_personnes=1,
                statut=StatutReservation.CONFIRMEE,
                id_client=client.id_client,
                id_salle=salle.id_salle,
            )
        )
        db.commit()
    db.rollback()

    assert "salle_sans_chevauchement" in str(capture.value)


def test_le_check_d_exclusivite_cohabite_avec_l_exclusion(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Les deux contraintes portent sur la même table et ne se gênent pas.

    `ck_reservation_cible_unique` interdit deux cibles sur une même ligne ;
    `salle_sans_chevauchement` interdit deux lignes sur le même créneau. Elles
    n'ont ni le même objet ni la même portée.
    """
    salle = _salle(db)
    logement = _logement(db)
    service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    # La contrainte d'exclusion n'empêche pas la ligne polymorphe valide.
    reservation = service.creer(
        ReservationCreate(
            type_reservation=TypeReservation.LOGEMENT,
            date_debut=REF_DEBUT,
            date_fin=REF_FIN,
            nombre_personnes=1,
            id_logement=logement.id_logement,
        ),
        client,
    )
    assert reservation.id_logement == logement.id_logement

    # Et le CHECK d'exclusivité mord toujours, sur une ligne à deux cibles.
    with pytest.raises(IntegrityError) as capture:
        db.add(
            Reservation(
                type_reservation=TypeReservation.SALLE,
                date_debut=REF_FIN + timedelta(days=5),
                date_fin=REF_FIN + timedelta(days=5, hours=2),
                nombre_personnes=1,
                statut=StatutReservation.CONFIRMEE,
                id_client=client.id_client,
                id_salle=salle.id_salle,
                id_logement=logement.id_logement,
            )
        )
        db.commit()
    db.rollback()

    assert "cible_unique" in str(capture.value)


# --- Refus propres aux biens ---------------------------------------------------


def test_salle_inexistante_leve_reference_invalide(
    service: ReservationService, client: Client
) -> None:
    with pytest.raises(ReferenceInvalide):
        service.creer(_creneau(99999, REF_DEBUT, REF_FIN), client)


def test_salle_archivee_traitee_comme_inexistante(
    service: ReservationService, client: Client, db: Session
) -> None:
    salle = _salle(db)
    salle.supprime_le = datetime.now(UTC)
    db.commit()

    with pytest.raises(ReferenceInvalide):
        service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)


def test_capacite_depassee_refusee(
    service: ReservationService, client: Client, db: Session
) -> None:
    """422 : le bien existe, c'est la demande qui ne lui correspond pas."""
    salle = _salle(db, capacite=10)

    with pytest.raises(ReferenceInvalide) as capture:
        service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN, nombre=15), client)

    assert "10" in str(capture.value)


@pytest.mark.parametrize(
    "statut", [StatutLogement.EN_MAINTENANCE, StatutLogement.HORS_SERVICE]
)
def test_logement_non_disponible_refuse(
    service: ReservationService, client: Client, db: Session, statut: StatutLogement
) -> None:
    """`En_maintenance` et `Hors_service` disent qu'il n'est pas louable.

    Le test **tente réellement la création** contre un logement dans ce statut,
    et vérifie trois choses : que le refus a lieu, qu'il porte bien sur le
    statut — un `ConflitMetier` peut venir d'ailleurs —, et qu'aucune ligne
    n'est écrite.

    Le contrôle positif est `test_le_meme_logement_disponible_est_reservable` :
    sans lui, ce test passerait même si toute réservation de logement échouait.
    """
    logement = _logement(db, statut)

    with pytest.raises(ConflitMetier) as capture:
        service.creer(_creneau_logement(logement.id_logement), client)

    assert statut.value in str(capture.value)
    assert service.lister_du_client(client) == []


def test_le_meme_logement_disponible_est_reservable(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Contrôle positif du test précédent.

    Le refus vient du statut, et de rien d'autre : le même montage avec
    `Disponible` aboutit.
    """
    logement = _logement(db, StatutLogement.DISPONIBLE)

    reservation = service.creer(_creneau_logement(logement.id_logement), client)

    assert reservation.id_logement == logement.id_logement


def test_reserver_un_bien_ne_touche_a_aucun_compteur(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Une salle n'a pas de `places_restantes` : rien à décrémenter ni à rendre.

    L'annulation d'une réservation de salle ne doit donc rien créditer — la
    garde de `_restituer` sur `id_session` s'en charge.
    """
    salle = _salle(db)
    reservation = service.creer(_creneau(salle.id_salle, REF_DEBUT, REF_FIN), client)

    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    assert reservation.id_session is None
    assert reservation.statut is StatutReservation.ANNULEE
