"""Tests du repository AVIS, contre PostgreSQL uniquement.

`AVIS` porte un `CHECK` croisant deux colonnes et deux index uniques
partiels : mêmes raisons que `test_beneficiaire_repository.py` d'écarter
SQLite.
"""

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.avis import Avis, TypeAvis
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.ligne_commande import LigneCommande
from app.models.logement import Logement, StatutLogement
from app.models.produit import Produit
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.models.salle import Salle
from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.repositories.avis_repository import AvisRepository

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def repository(db: Session) -> AvisRepository:
    return AvisRepository(db)


def _client(db: Session, email: str = "a@delta.mg") -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER, email=email, mot_de_passe=MOT_DE_PASSE
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.flush()
    return client


def _produit(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat-{uuid4().hex[:8]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Baguette",
        description="desc",
        prix_unitaire=1000,
        unite_mesure="unite",
        stock_disponible=10,
        est_personnalisable=False,
        est_livrable=True,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.flush()
    return produit


def _ligne_pour_produit(db: Session, client: Client, produit: Produit) -> LigneCommande:
    commande = Commande(
        type_commande=TypeCommande.SUR_PLACE,
        statut=StatutCommande.SERVIE,
        montant_total=1000,
        id_client=client.id_client,
    )
    db.add(commande)
    db.flush()
    ligne = LigneCommande(
        quantite=1,
        prix_unitaire_applique=1000,
        id_commande=commande.id_commande,
        id_produit=produit.id_produit,
    )
    db.add(ligne)
    db.flush()
    return ligne


def _ligne(db: Session, client: Client) -> LigneCommande:
    return _ligne_pour_produit(db, client, _produit(db))


def _reservation(db: Session, client: Client, **cible: object) -> Reservation:
    donnees: dict[str, object] = {
        "type_reservation": TypeReservation.TABLE,
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 1, 1),
        "nombre_personnes": 2,
        "statut": StatutReservation.HONOREE,
        "avec_hebergement": False,
        "id_client": client.id_client,
    }
    if "id_salle" in cible:
        donnees["type_reservation"] = TypeReservation.SALLE
    elif "id_logement" in cible:
        donnees["type_reservation"] = TypeReservation.LOGEMENT
    elif "id_session" in cible:
        donnees["type_reservation"] = TypeReservation.FORMATION
    donnees.update(cible)
    reservation = Reservation(**donnees)
    db.add(reservation)
    db.flush()
    return reservation


def _salle(db: Session) -> Salle:
    salle = Salle(nom=f"Salle-{uuid4().hex[:8]}", capacite=10, tarif_horaire=1000)
    db.add(salle)
    db.flush()
    return salle


def _logement(db: Session) -> Logement:
    logement = Logement(
        type_chambre="Simple",
        capacite=2,
        tarif_nuitee=1000,
        statut=StatutLogement.DISPONIBLE,
    )
    db.add(logement)
    db.flush()
    return logement


def _formation(db: Session) -> Formation:
    domaine = DomaineFormation(libelle=f"Domaine-{uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    formation = Formation(
        titre="Pâtisserie",
        duree_heures=10,
        prix=1000,
        capacite_max=10,
        propose_hebergement=False,
        id_domaine=domaine.id_domaine,
    )
    db.add(formation)
    db.flush()
    return formation


def _session(db: Session, formation: Formation) -> SessionFormation:
    session = SessionFormation(
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 1, 2),
        places_restantes=10,
        statut=StatutSessionFormation.OUVERTE,
        id_formation=formation.id_formation,
    )
    db.add(session)
    db.flush()
    return session


def _avis_produit(db: Session, client: Client, ligne: LigneCommande, note: int) -> Avis:
    avis = Avis(
        type_avis=TypeAvis.PRODUIT,
        note=note,
        id_client=client.id_client,
        id_ligne=ligne.id_ligne,
    )
    db.add(avis)
    db.flush()
    return avis


def _avis_service(
    db: Session, client: Client, reservation: Reservation, note: int
) -> Avis:
    avis = Avis(
        type_avis=TypeAvis.SERVICE,
        note=note,
        id_client=client.id_client,
        id_reservation=reservation.id_reservation,
    )
    db.add(avis)
    db.flush()
    return avis


def test_par_ligne_ne_retourne_que_les_avis_actifs(
    db: Session, repository: AvisRepository
) -> None:
    client = _client(db)
    ligne = _ligne(db, client)
    avis = Avis(
        type_avis=TypeAvis.PRODUIT,
        note=5,
        id_client=client.id_client,
        id_ligne=ligne.id_ligne,
    )
    db.add(avis)
    db.flush()

    resultat = repository.par_ligne(ligne.id_ligne)

    assert len(resultat) == 1
    assert resultat[0].id_avis == avis.id_avis


def test_par_ligne_exclut_les_avis_archives(
    db: Session, repository: AvisRepository
) -> None:
    client = _client(db)
    ligne = _ligne(db, client)
    avis = Avis(
        type_avis=TypeAvis.PRODUIT,
        note=5,
        id_client=client.id_client,
        id_ligne=ligne.id_ligne,
    )
    avis.supprime_le = datetime.now(UTC)
    db.add(avis)
    db.flush()

    resultat = repository.par_ligne(ligne.id_ligne)

    assert resultat == []


def test_par_reservation_ne_retourne_que_les_avis_actifs(
    db: Session, repository: AvisRepository
) -> None:
    client = _client(db)
    reservation = _reservation(db, client)
    avis = Avis(
        type_avis=TypeAvis.SERVICE,
        note=4,
        id_client=client.id_client,
        id_reservation=reservation.id_reservation,
    )
    db.add(avis)
    db.flush()

    resultat = repository.par_reservation(reservation.id_reservation)

    assert len(resultat) == 1
    assert resultat[0].id_avis == avis.id_avis


# --- Notes moyennes (8.3) ---------------------------------------------------


def test_moyenne_par_produit_sans_avis_retourne_none_et_zero(
    db: Session, repository: AvisRepository
) -> None:
    produit = _produit(db)

    resultat = repository.moyenne_par_produit(produit.id_produit)

    assert resultat.moyenne is None
    assert resultat.nombre == 0


def test_moyenne_par_produit_agrege_plusieurs_clients(
    db: Session, repository: AvisRepository
) -> None:
    produit = _produit(db)
    a = _client(db, "a@delta.mg")
    b = _client(db, "b@delta.mg")
    _avis_produit(db, a, _ligne_pour_produit(db, a, produit), 5)
    _avis_produit(db, b, _ligne_pour_produit(db, b, produit), 3)

    resultat = repository.moyenne_par_produit(produit.id_produit)

    assert resultat.moyenne == 4
    assert resultat.nombre == 2


def test_moyenne_par_produit_exclut_les_avis_archives(
    db: Session, repository: AvisRepository
) -> None:
    produit = _produit(db)
    client = _client(db)
    avis = _avis_produit(db, client, _ligne_pour_produit(db, client, produit), 1)
    avis.supprime_le = datetime.now(UTC)
    db.flush()

    resultat = repository.moyenne_par_produit(produit.id_produit)

    assert resultat.moyenne is None
    assert resultat.nombre == 0


def test_moyenne_par_produit_ignore_les_avis_d_un_autre_produit(
    db: Session, repository: AvisRepository
) -> None:
    produit_a = _produit(db)
    produit_b = _produit(db)
    client = _client(db)
    _avis_produit(db, client, _ligne_pour_produit(db, client, produit_b), 5)

    resultat = repository.moyenne_par_produit(produit_a.id_produit)

    assert resultat.moyenne is None
    assert resultat.nombre == 0


def test_moyenne_par_salle_agrege_les_avis_actifs(
    db: Session, repository: AvisRepository
) -> None:
    salle = _salle(db)
    a = _client(db, "a@delta.mg")
    b = _client(db, "b@delta.mg")
    _avis_service(db, a, _reservation(db, a, id_salle=salle.id_salle), 4)
    _avis_service(db, b, _reservation(db, b, id_salle=salle.id_salle), 2)

    resultat = repository.moyenne_par_salle(salle.id_salle)

    assert resultat.moyenne == 3
    assert resultat.nombre == 2


def test_moyenne_par_salle_ignore_une_autre_salle(
    db: Session, repository: AvisRepository
) -> None:
    salle_a = _salle(db)
    salle_b = _salle(db)
    client = _client(db)
    _avis_service(db, client, _reservation(db, client, id_salle=salle_b.id_salle), 5)

    resultat = repository.moyenne_par_salle(salle_a.id_salle)

    assert resultat.moyenne is None
    assert resultat.nombre == 0


def test_moyenne_par_logement_agrege_les_avis_actifs(
    db: Session, repository: AvisRepository
) -> None:
    logement = _logement(db)
    client = _client(db)
    _avis_service(
        db, client, _reservation(db, client, id_logement=logement.id_logement), 5
    )

    resultat = repository.moyenne_par_logement(logement.id_logement)

    assert resultat.moyenne == 5
    assert resultat.nombre == 1


def test_moyenne_par_formation_agrege_toutes_les_sessions(
    db: Session, repository: AvisRepository
) -> None:
    """Granularité FORMATION et non SESSION_FORMATION (décision actée au
    Sprint 8) : deux sessions différentes de la même formation contribuent
    à la même moyenne."""
    formation = _formation(db)
    session_1 = _session(db, formation)
    session_2 = _session(db, formation)
    a = _client(db, "a@delta.mg")
    b = _client(db, "b@delta.mg")
    _avis_service(db, a, _reservation(db, a, id_session=session_1.id_session), 5)
    _avis_service(db, b, _reservation(db, b, id_session=session_2.id_session), 1)

    resultat = repository.moyenne_par_formation(formation.id_formation)

    assert resultat.moyenne == 3
    assert resultat.nombre == 2


def test_moyenne_par_formation_ignore_une_autre_formation(
    db: Session, repository: AvisRepository
) -> None:
    formation_a = _formation(db)
    formation_b = _formation(db)
    session_b = _session(db, formation_b)
    client = _client(db)
    _avis_service(
        db, client, _reservation(db, client, id_session=session_b.id_session), 5
    )

    resultat = repository.moyenne_par_formation(formation_a.id_formation)

    assert resultat.moyenne is None
    assert resultat.nombre == 0
