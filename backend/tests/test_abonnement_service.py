"""Tests du service ABONNEMENT.

Sur `session_postgres` et non SQLite : `ABONNEMENT` porte une contrainte
d'exclusion `EXCLUDE USING gist`, que SQLite ne sait pas créer. Même
raisonnement que `test_reservation_service.py` pour `SALLE`/`LOGEMENT`.
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import (
    AutorisationInsuffisante,
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.security import hacher_mot_de_passe
from app.models.abonnement import ModeSuivi, TypeFacturation
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.models.client_particulier import ClientParticulier
from app.schemas.abonnement import (
    AbonnementCreate,
    AbonnementCreateAdmin,
    AbonnementUpdate,
)
from app.services.abonnement_service import AbonnementService

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> AbonnementService:
    return AbonnementService(db)


def _entreprise(db: Session, numero: str = "1111111111") -> Client:
    client = Client(
        type_client=TypeClient.ENTREPRISE,
        email=f"{numero}@societe.mg",
        mot_de_passe=MOT_DE_PASSE,
    )
    client.entreprise = ClientEntreprise(
        raison_sociale="Société A", numero_id_fiscal=numero
    )
    db.add(client)
    db.flush()
    return client


def _particulier(db: Session) -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email="jean@delta.mg",
        mot_de_passe=MOT_DE_PASSE,
    )
    client.particulier = ClientParticulier(nom="Rakoto", prenom="Jean")
    db.add(client)
    db.flush()
    return client


def _charge_utile(**overrides: object) -> AbonnementCreate:
    donnees = {
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 12, 31),
        "type_facturation": TypeFacturation.FORFAIT,
        "mode_suivi": ModeSuivi.GLOBAL,
        "nombre_repas_inclus": 200,
        "tarif_forfait": 500000,
    }
    donnees.update(overrides)
    return AbonnementCreate(**donnees)


# --- creer (client) ---------------------------------------------------------


def test_creer_pour_client_entreprise(db: Session, service: AbonnementService) -> None:
    entreprise = _entreprise(db)

    abonnement = service.creer(_charge_utile(), entreprise)

    assert abonnement.id_client_entreprise == entreprise.id_client


def test_creer_refuse_un_client_particulier(
    db: Session, service: AbonnementService
) -> None:
    particulier = _particulier(db)

    with pytest.raises(AutorisationInsuffisante):
        service.creer(_charge_utile(), particulier)


# --- creer_pour_entreprise (admin) ------------------------------------------


def test_creer_pour_entreprise(db: Session, service: AbonnementService) -> None:
    entreprise = _entreprise(db)

    abonnement = service.creer_pour_entreprise(
        AbonnementCreateAdmin(
            date_debut=date(2026, 1, 1),
            date_fin=date(2026, 12, 31),
            type_facturation=TypeFacturation.FORFAIT,
            mode_suivi=ModeSuivi.GLOBAL,
            tarif_forfait=500000,
            id_client_entreprise=entreprise.id_client,
        )
    )

    assert abonnement.id_client_entreprise == entreprise.id_client


def test_creer_pour_entreprise_inexistante_donne_reference_invalide(
    service: AbonnementService,
) -> None:
    with pytest.raises(ReferenceInvalide):
        service.creer_pour_entreprise(
            AbonnementCreateAdmin(
                date_debut=date(2026, 1, 1),
                date_fin=date(2026, 12, 31),
                type_facturation=TypeFacturation.FORFAIT,
                mode_suivi=ModeSuivi.GLOBAL,
                tarif_forfait=500000,
                id_client_entreprise=999,
            )
        )


# --- Lecture avec portee -----------------------------------------------------


def test_obtenir_du_client_entreprise_refuse_celui_d_une_autre(
    db: Session, service: AbonnementService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement = service.creer(_charge_utile(), entreprise_a)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_du_client_entreprise(abonnement.id_abonnement, entreprise_b)


def test_lister_du_client_entreprise_ne_retourne_que_les_siens(
    db: Session, service: AbonnementService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    service.creer(_charge_utile(), entreprise_a)
    service.creer(_charge_utile(), entreprise_b)

    resultat = service.lister_du_client_entreprise(entreprise_a)

    assert len(resultat) == 1
    assert resultat[0].id_client_entreprise == entreprise_a.id_client


# --- Chevauchement -----------------------------------------------------------


def test_creer_refuse_un_chevauchement_pour_la_meme_entreprise(
    db: Session, service: AbonnementService
) -> None:
    entreprise = _entreprise(db)
    service.creer(
        _charge_utile(date_debut=date(2026, 1, 1), date_fin=date(2026, 12, 31)),
        entreprise,
    )

    with pytest.raises(ConflitMetier):
        service.creer(
            _charge_utile(date_debut=date(2026, 6, 1), date_fin=date(2027, 6, 1)),
            entreprise,
        )


def test_creer_accepte_un_renouvellement_adjacent(
    db: Session, service: AbonnementService
) -> None:
    """Bornes `[)` : le nouveau commence le jour où l'ancien se termine."""
    entreprise = _entreprise(db)
    service.creer(
        _charge_utile(date_debut=date(2026, 1, 1), date_fin=date(2026, 12, 31)),
        entreprise,
    )

    renouvellement = service.creer(
        _charge_utile(date_debut=date(2026, 12, 31), date_fin=date(2027, 12, 31)),
        entreprise,
    )

    assert renouvellement.id_abonnement is not None


def test_creer_accepte_un_chevauchement_entre_deux_entreprises_differentes(
    db: Session, service: AbonnementService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    service.creer(
        _charge_utile(date_debut=date(2026, 1, 1), date_fin=date(2026, 12, 31)),
        entreprise_a,
    )

    abonnement_b = service.creer(
        _charge_utile(date_debut=date(2026, 6, 1), date_fin=date(2027, 6, 1)),
        entreprise_b,
    )

    assert abonnement_b.id_client_entreprise == entreprise_b.id_client


def test_modifier_refuse_un_chevauchement_introduit_par_un_deplacement_de_dates(
    db: Session, service: AbonnementService
) -> None:
    entreprise = _entreprise(db)
    service.creer(
        _charge_utile(date_debut=date(2026, 1, 1), date_fin=date(2026, 6, 30)),
        entreprise,
    )
    second = service.creer(
        _charge_utile(date_debut=date(2027, 1, 1), date_fin=date(2027, 12, 31)),
        entreprise,
    )

    with pytest.raises(ConflitMetier):
        service.modifier(
            second.id_abonnement,
            AbonnementUpdate(date_debut=date(2026, 3, 1)),
        )


# --- Modification -----------------------------------------------------------


def test_modifier_refuse_passage_a_forfait_sans_tarif(
    db: Session, service: AbonnementService
) -> None:
    entreprise = _entreprise(db)
    abonnement = service.creer(
        _charge_utile(
            type_facturation=TypeFacturation.CONSOMMATION_REELLE,
            tarif_forfait=None,
            tarif_unitaire_repas=2500,
        ),
        entreprise,
    )

    with pytest.raises(ReferenceInvalide):
        service.modifier(
            abonnement.id_abonnement,
            AbonnementUpdate(type_facturation=TypeFacturation.FORFAIT),
        )


def test_modifier_accepte_passage_a_forfait_si_tarif_deja_present(
    db: Session, service: AbonnementService
) -> None:
    entreprise = _entreprise(db)
    abonnement = service.creer(
        _charge_utile(
            type_facturation=TypeFacturation.CONSOMMATION_REELLE,
            tarif_forfait=500000,
            tarif_unitaire_repas=2500,
        ),
        entreprise,
    )

    resultat = service.modifier(
        abonnement.id_abonnement,
        AbonnementUpdate(type_facturation=TypeFacturation.FORFAIT),
    )

    assert resultat.type_facturation == TypeFacturation.FORFAIT


def test_modifier_refuse_fin_anterieure_au_debut(
    db: Session, service: AbonnementService
) -> None:
    entreprise = _entreprise(db)
    abonnement = service.creer(_charge_utile(), entreprise)

    with pytest.raises(ReferenceInvalide):
        service.modifier(
            abonnement.id_abonnement,
            AbonnementUpdate(date_fin=date(2025, 1, 1)),
        )


# --- Suppression --------------------------------------------------------


def test_supprimer_archive(db: Session, service: AbonnementService) -> None:
    entreprise = _entreprise(db)
    abonnement = service.creer(_charge_utile(), entreprise)

    service.supprimer(abonnement.id_abonnement)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(abonnement.id_abonnement)
