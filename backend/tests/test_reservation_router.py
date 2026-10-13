"""Tests HTTP des réservations, contre PostgreSQL uniquement.

Même contrainte que `test_reservation_service.py` : le `CHECK` d'exclusivité de
`RESERVATION` utilise la syntaxe PostgreSQL `(colonne IS NOT NULL)::int`.

Point de vigilance : `id_client` vient **toujours** du jeton. Un client ne doit
ni lire ni modifier la réservation d'un autre, et la réponse ne doit pas non plus
confirmer qu'elle existe.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.session_formation import SessionFormation, StatutSessionFormation
from tests.conftest import authentifier

pytestmark = pytest.mark.postgres

RESERVATIONS = f"{settings.API_V1_PREFIX}/reservations"
MDP = "motdepasse123"
DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(days=4)


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def client_http(db: Session) -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        app.dependency_overrides.clear()


def _compte(db: Session, prefixe: str = "jean") -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"{prefixe}_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(compte)
    db.commit()
    return compte


def _entete(compte: Client) -> dict[str, str]:
    return authentifier(compte.id_client, TypeSujet.CLIENT)


@pytest.fixture
def compte(db: Session) -> Client:
    return _compte(db)


@pytest.fixture
def entete(compte: Client) -> dict[str, str]:
    return _entete(compte)


def _session_ouverte(db: Session, capacite: int = 12) -> SessionFormation:
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


def _corps(id_session: int, nombre: int = 1, **extra: object) -> dict:
    return {
        "type_reservation": "Formation",
        "date_debut": DEBUT.isoformat(),
        "date_fin": FIN.isoformat(),
        "nombre_personnes": nombre,
        "id_session": id_session,
        **extra,
    }


# --- Accès --------------------------------------------------------------------


def test_sans_jeton_tout_est_refuse(
    client_http: TestClient, session_ouverte: SessionFormation
) -> None:
    """Une réservation est un engagement nominatif."""
    assert client_http.get(RESERVATIONS).status_code == 401
    assert (
        client_http.post(
            RESERVATIONS, json=_corps(session_ouverte.id_session)
        ).status_code
        == 401
    )


def test_un_jeton_personnel_n_ouvre_rien(
    client_http: TestClient, db: Session, session_ouverte: SessionFormation
) -> None:
    """Le cloisonnement des deux populations vaut aussi ici."""
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()

    reponse = client_http.get(
        RESERVATIONS, headers=authentifier(agent.id_personnel, TypeSujet.PERSONNEL)
    )

    assert reponse.status_code == 401


# --- Création -----------------------------------------------------------------


def test_creation_et_decrement(
    client_http: TestClient,
    entete: dict[str, str],
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    reponse = client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session, nombre=3), headers=entete
    )

    assert reponse.status_code == 201
    assert reponse.json()["statut"] == "En_attente"
    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 9


def test_client_envoye_dans_le_corps_est_ignore(
    client_http: TestClient,
    entete: dict[str, str],
    compte: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Sinon on réserverait au nom d'autrui."""
    autre = _compte(db, "autre")

    reponse = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session, id_client=autre.id_client),
        headers=entete,
    )

    assert reponse.json()["id_client"] == compte.id_client


def test_places_insuffisantes_retourne_409(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    session = _session_ouverte(db, capacite=2)

    reponse = client_http.post(
        RESERVATIONS, json=_corps(session.id_session, nombre=5), headers=entete
    )

    assert reponse.status_code == 409
    assert "2" in reponse.json()["detail"]


def test_session_inconnue_retourne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """422 et non 404 : l'URL est valide, c'est le corps qui ne l'est pas."""
    reponse = client_http.post(RESERVATIONS, json=_corps(99999), headers=entete)

    assert reponse.status_code == 422


def test_session_non_ouverte_retourne_409(
    client_http: TestClient,
    entete: dict[str, str],
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    session_ouverte.statut = StatutSessionFormation.PLANIFIEE
    db.commit()

    reponse = client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=entete
    )

    assert reponse.status_code == 409


@pytest.mark.parametrize(
    "corps_invalide",
    [
        {"type_reservation": "Formation", "id_session": None},
        # `Salle` et `Logement` sont acceptés depuis #47, mais chacun doit
        # désigner sa cible — et `id_session` reste réservé à `Formation`.
        {"type_reservation": "Salle"},
        {"type_reservation": "Logement"},
        {"nombre_personnes": 0},
    ],
)
def test_corps_invalide_retourne_422(
    client_http: TestClient,
    entete: dict[str, str],
    session_ouverte: SessionFormation,
    corps_invalide: dict,
) -> None:
    corps = {**_corps(session_ouverte.id_session), **corps_invalide}

    assert client_http.post(RESERVATIONS, json=corps, headers=entete).status_code == 422


# --- Cycle complet ------------------------------------------------------------


def test_cycle_complet_par_http(client_http: TestClient, db: Session) -> None:
    """Le test qui prouve quelque chose, vu du client.

    Dernière place prise, tiers refusé, annulation, tiers accepté.
    """
    session = _session_ouverte(db, capacite=1)
    premier = _compte(db, "premier")
    tiers = _compte(db, "tiers")

    creee = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=_entete(premier)
    )
    assert creee.status_code == 201

    refusee = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=_entete(tiers)
    )
    assert refusee.status_code == 409

    annulee = client_http.put(
        f"{RESERVATIONS}/{creee.json()['id_reservation']}/statut",
        json={"statut": "Annulee"},
        headers=_entete(premier),
    )
    assert annulee.status_code == 200

    reussie = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=_entete(tiers)
    )
    assert reussie.status_code == 201


# --- Isolation entre clients --------------------------------------------------


def test_la_reservation_d_autrui_retourne_404(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    """404 et non 403 : confirmer son existence renseignerait déjà."""
    proprietaire = _compte(db, "proprietaire")
    autre = _compte(db, "autre")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.get(
        f"{RESERVATIONS}/{creee['id_reservation']}", headers=_entete(autre)
    )

    assert reponse.status_code == 404


def test_annuler_la_reservation_d_autrui_retourne_404(
    client_http: TestClient,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Et surtout : la place ne doit pas être restituée au passage."""
    proprietaire = _compte(db, "proprietaire")
    autre = _compte(db, "autre")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.put(
        f"{RESERVATIONS}/{creee['id_reservation']}/statut",
        json={"statut": "Annulee"},
        headers=_entete(autre),
    )

    assert reponse.status_code == 404
    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 11


def test_historique_ne_montre_que_ses_propres_reservations(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    premier = _compte(db, "premier")
    second = _compte(db, "second")
    client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=_entete(premier)
    )
    client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=_entete(second)
    )

    reponse = client_http.get(RESERVATIONS, headers=_entete(premier))

    assert len(reponse.json()) == 1
    assert reponse.json()[0]["id_client"] == premier.id_client


# --- Option hébergement -------------------------------------------------------


def _session_hebergement(db: Session, propose: bool) -> SessionFormation:
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


def test_hebergement_accepte(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    session = _session_hebergement(db, propose=True)

    reponse = client_http.post(
        RESERVATIONS,
        json=_corps(session.id_session, avec_hebergement=True),
        headers=entete,
    )

    assert reponse.status_code == 201
    assert reponse.json()["avec_hebergement"] is True


def test_hebergement_non_propose_retourne_422(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    session = _session_hebergement(db, propose=False)

    reponse = client_http.post(
        RESERVATIONS,
        json=_corps(session.id_session, avec_hebergement=True),
        headers=entete,
    )

    assert reponse.status_code == 422
    assert "hébergement" in reponse.json()["detail"]


def test_hebergement_hors_formation_retourne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    corps = {
        "type_reservation": "Table",
        "date_debut": DEBUT.isoformat(),
        "date_fin": FIN.isoformat(),
        "avec_hebergement": True,
    }

    assert client_http.post(RESERVATIONS, json=corps, headers=entete).status_code == 422


def test_le_refus_ne_consomme_aucune_place(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    session = _session_hebergement(db, propose=False)

    client_http.post(
        RESERVATIONS,
        json=_corps(session.id_session, avec_hebergement=True),
        headers=entete,
    )

    db.refresh(session)
    assert session.places_restantes == 12


# --- Réservation de table (#64) -----------------------------------------------


def _corps_table(**extra: object) -> dict:
    return {
        "type_reservation": "Table",
        "date_debut": DEBUT.isoformat(),
        "date_fin": FIN.isoformat(),
        "nombre_personnes": 4,
        **extra,
    }


def test_reservation_de_table_retourne_201(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """Contrôle positif du contrat HTTP : aucune cible n'est requise.

    Le `CHECK` d'exclusivité autorise zéro colonne renseignée — c'est
    exactement ce cas qu'il prévoit.
    """
    reponse = client_http.post(RESERVATIONS, json=_corps_table(), headers=entete)

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["type_reservation"] == "Table"
    assert corps["id_session"] is None
    assert corps["id_salle"] is None
    assert corps["id_logement"] is None


@pytest.mark.parametrize("colonne", ["id_session", "id_salle", "id_logement"])
def test_une_table_avec_une_cible_retourne_422(
    client_http: TestClient, entete: dict[str, str], colonne: str
) -> None:
    """422 et non 404 : la référence vient du corps, pas de l'URL."""
    reponse = client_http.post(
        RESERVATIONS, json=_corps_table(**{colonne: 1}), headers=entete
    )

    assert reponse.status_code == 422


# --- Administration (10.2) -----------------------------------------------------


def _entete_admin(db: Session) -> dict[str, str]:
    admin = Personnel(
        nom="Admin",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"admin_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=True,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(admin)
    db.commit()
    return authentifier(admin.id_personnel, TypeSujet.PERSONNEL)


def _entete_agent(db: Session) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=False,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()
    return authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


def test_administration_liste_les_reservations_de_tous_les_clients(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    premier = _compte(db, "premier")
    autre = _compte(db, "autre")
    client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=_entete(premier)
    )
    client_http.post(RESERVATIONS, json=_corps_table(), headers=_entete(autre))

    reponse = client_http.get(
        f"{RESERVATIONS}/administration", headers=_entete_admin(db)
    )

    assert reponse.status_code == 200
    ids_clients = {r["id_client"] for r in reponse.json()}
    assert {premier.id_client, autre.id_client} <= ids_clients


def test_administration_liste_refusee_a_un_client(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.get(f"{RESERVATIONS}/administration", headers=entete)

    assert reponse.status_code == 401


def test_administration_liste_refusee_a_un_salarie_sans_droit(
    client_http: TestClient, db: Session
) -> None:
    reponse = client_http.get(
        f"{RESERVATIONS}/administration", headers=_entete_agent(db)
    )

    assert reponse.status_code == 403


def test_administration_obtient_la_reservation_d_un_client_quelconque(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    """Contrairement à l'endpoint client, aucune vérification de propriété :
    c'est le point même de l'administration."""
    proprietaire = _compte(db, "proprietaire")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.get(
        f"{RESERVATIONS}/administration/{creee['id_reservation']}",
        headers=_entete_admin(db),
    )

    assert reponse.status_code == 200
    assert reponse.json()["id_client"] == proprietaire.id_client


def test_administration_obtenir_un_inconnu_retourne_404(
    client_http: TestClient, db: Session
) -> None:
    reponse = client_http.get(
        f"{RESERVATIONS}/administration/999999", headers=_entete_admin(db)
    )

    assert reponse.status_code == 404


def test_administration_peut_marquer_honoree(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    proprietaire = _compte(db, "proprietaire")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.put(
        f"{RESERVATIONS}/administration/{creee['id_reservation']}/statut",
        json={"statut": "Honoree"},
        headers=_entete_admin(db),
    )

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "Honoree"


def test_administration_statut_refuse_a_un_salarie_sans_droit(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    proprietaire = _compte(db, "proprietaire")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.put(
        f"{RESERVATIONS}/administration/{creee['id_reservation']}/statut",
        json={"statut": "Honoree"},
        headers=_entete_agent(db),
    )

    assert reponse.status_code == 403


def test_client_ne_peut_plus_se_declarer_lui_meme_honoree(
    client_http: TestClient, session_ouverte: SessionFormation, entete: dict[str, str]
) -> None:
    """Le cœur du correctif 10.2 : c'était auparavant accepté, ce qui
    débloquait un avis de service sans prestation réelle."""
    creee = client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=entete
    ).json()

    reponse = client_http.put(
        f"{RESERVATIONS}/{creee['id_reservation']}/statut",
        json={"statut": "Honoree"},
        headers=entete,
    )

    assert reponse.status_code == 422


def test_client_annuler_sans_statut_utilise_le_defaut(
    client_http: TestClient, session_ouverte: SessionFormation, entete: dict[str, str]
) -> None:
    """`ReservationAnnulation.statut` a une valeur par défaut : un corps vide
    annule quand même, la seule transition possible n'ayant pas besoin d'être
    nommée."""
    creee = client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=entete
    ).json()

    reponse = client_http.put(
        f"{RESERVATIONS}/{creee['id_reservation']}/statut", json={}, headers=entete
    )

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "Annulee"


def test_administration_liste_les_plus_recentes_d_abord(
    client_http: TestClient, db: Session
) -> None:
    """Demande du 13 octobre 2026 : la dernière réservation faite en haut."""
    compte = _compte(db, "recentes")
    ids = [
        client_http.post(
            RESERVATIONS, json=_corps_table(), headers=_entete(compte)
        ).json()["id_reservation"]
        for _ in range(2)
    ]

    liste = client_http.get(
        f"{RESERVATIONS}/administration", headers=_entete_admin(db)
    ).json()
    ordre = [r["id_reservation"] for r in liste]

    assert ordre == sorted(ordre, reverse=True)
    assert ordre.index(ids[1]) < ordre.index(ids[0])


# --- Prix figé et acompte (13 octobre 2026) ------------------------------

PAIEMENTS = f"{settings.API_V1_PREFIX}/paiements"
MVOLA = {
    "methode": "Mobile_money",
    "fournisseur": "Mvola",
    "numero_mobile_money": "034 12 345 67",
}


def _reserver(client_http: TestClient, entete: dict[str, str], corps: dict) -> dict:
    reponse = client_http.post(RESERVATIONS, json=corps, headers=entete)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def test_une_formation_porte_son_prix_et_son_acompte(
    client_http: TestClient, db: Session, session_ouverte: SessionFormation
) -> None:
    """850 000 Ar par personne, 2 personnes : 1 700 000 Ar, acompte 30 %."""
    entete = _entete(_compte(db, "prix"))

    reservation = _reserver(client_http, entete, _corps(session_ouverte.id_session, 2))

    assert Decimal(reservation["montant_total"]) == Decimal("1700000.00")
    assert Decimal(reservation["montant_acompte"]) == Decimal("510000.00")
    assert reservation["acompte_paye"] is False
    assert reservation["acompte_avant"] is not None


def test_le_prix_ne_vient_jamais_de_la_requete(
    client_http: TestClient, db: Session, session_ouverte: SessionFormation
) -> None:
    entete = _entete(_compte(db, "triche"))

    reponse = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session, montant_total="1", montant_acompte="0"),
        headers=entete,
    )

    assert reponse.status_code in (201, 422)
    if reponse.status_code == 201:
        assert Decimal(reponse.json()["montant_total"]) == Decimal("850000.00")


def test_une_table_ne_demande_ni_prix_ni_acompte(
    client_http: TestClient, db: Session
) -> None:
    reservation = _reserver(client_http, _entete(_compte(db, "table")), _corps_table())

    assert reservation["montant_total"] is None
    assert reservation["montant_acompte"] is None
    assert reservation["acompte_avant"] is None


def test_payer_l_acompte_confirme_la_reservation(
    client_http: TestClient,
    db: Session,
    session_ouverte: SessionFormation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "developpement")
    entete = _entete(_compte(db, "acompte"))
    reservation = _reserver(client_http, entete, _corps(session_ouverte.id_session))

    paiement = client_http.post(
        f"{RESERVATIONS}/{reservation['id_reservation']}/paiements",
        json=MVOLA,
        headers=entete,
    )
    assert paiement.status_code == 201
    assert paiement.json()["id_reservation"] == reservation["id_reservation"]
    assert paiement.json()["id_commande"] is None
    assert Decimal(paiement.json()["montant"]) == Decimal("255000.00")

    confirmation = client_http.post(
        f"{PAIEMENTS}/{paiement.json()['id_paiement']}/simuler-confirmation",
        headers=entete,
    )
    assert confirmation.json()["statut"] == "Reussi"

    lue = client_http.get(
        f"{RESERVATIONS}/{reservation['id_reservation']}", headers=entete
    ).json()
    assert lue["statut"] == "Confirmee"
    assert lue["acompte_paye"] is True
    assert lue["acompte_avant"] is None

    # Plus rien à payer.
    second = client_http.post(
        f"{RESERVATIONS}/{reservation['id_reservation']}/paiements",
        json=MVOLA,
        headers=entete,
    )
    assert second.status_code == 409


def test_une_table_n_a_pas_d_acompte_a_payer(
    client_http: TestClient, db: Session
) -> None:
    entete = _entete(_compte(db, "tablepaie"))
    reservation = _reserver(client_http, entete, _corps_table())

    reponse = client_http.post(
        f"{RESERVATIONS}/{reservation['id_reservation']}/paiements",
        json=MVOLA,
        headers=entete,
    )

    assert reponse.status_code == 422


def test_l_acompte_d_un_autre_client_repond_404(
    client_http: TestClient, db: Session, session_ouverte: SessionFormation
) -> None:
    reservation = _reserver(
        client_http, _entete(_compte(db, "proprio")), _corps(session_ouverte.id_session)
    )

    reponse = client_http.post(
        f"{RESERVATIONS}/{reservation['id_reservation']}/paiements",
        json=MVOLA,
        headers=_entete(_compte(db, "intrus")),
    )

    assert reponse.status_code == 404
