"""Tests du repository ABONNEMENT."""

from collections.abc import Iterator
from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.repositories.abonnement_repository import AbonnementRepository
from tests.conftest import creer_engine_sqlite

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Client.__table__, ClientEntreprise.__table__, Abonnement.__table__
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def repository(db: Session) -> AbonnementRepository:
    return AbonnementRepository(db)


def _creer_entreprise(
    db: Session, raison_sociale: str, numero: str
) -> ClientEntreprise:
    client = Client(
        type_client=TypeClient.ENTREPRISE,
        email=f"{numero}@societe.mg",
        mot_de_passe=MOT_DE_PASSE,
    )
    client.entreprise = ClientEntreprise(
        raison_sociale=raison_sociale, numero_id_fiscal=numero
    )
    db.add(client)
    db.flush()
    return client.entreprise


def _abonnement(id_client_entreprise: int, **overrides: object) -> dict:
    donnees = {
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 12, 31),
        "type_facturation": TypeFacturation.FORFAIT,
        "mode_suivi": ModeSuivi.GLOBAL,
        "nombre_repas_inclus": 200,
        "tarif_forfait": 500000,
        "id_client_entreprise": id_client_entreprise,
    }
    donnees.update(overrides)
    return donnees


def test_creer_et_obtenir(db: Session, repository: AbonnementRepository) -> None:
    entreprise = _creer_entreprise(db, "Société A", "1111111111")

    abonnement = repository.create(_abonnement(entreprise.id_client))
    db.commit()

    trouve = repository.get_by_id(abonnement.id_abonnement)
    assert trouve is not None
    assert trouve.id_client_entreprise == entreprise.id_client


def test_par_client_entreprise_ne_retourne_que_les_siens(
    db: Session, repository: AbonnementRepository
) -> None:
    entreprise_a = _creer_entreprise(db, "Société A", "1111111111")
    entreprise_b = _creer_entreprise(db, "Société B", "2222222222")
    repository.create(_abonnement(entreprise_a.id_client))
    repository.create(_abonnement(entreprise_b.id_client))
    db.commit()

    resultat = repository.par_client_entreprise(entreprise_a.id_client)

    assert len(resultat) == 1
    assert resultat[0].id_client_entreprise == entreprise_a.id_client


def test_par_client_entreprise_exclut_les_archives_par_defaut(
    db: Session, repository: AbonnementRepository
) -> None:
    entreprise = _creer_entreprise(db, "Société A", "1111111111")
    abonnement = repository.create(_abonnement(entreprise.id_client))
    db.commit()
    repository.delete(abonnement)
    db.commit()

    assert repository.par_client_entreprise(entreprise.id_client) == []
    assert (
        len(
            repository.par_client_entreprise(
                entreprise.id_client, inclure_supprimes=True
            )
        )
        == 1
    )


def test_par_client_entreprise_ordonne_du_plus_recent(
    db: Session, repository: AbonnementRepository
) -> None:
    entreprise = _creer_entreprise(db, "Société A", "1111111111")
    repository.create(
        _abonnement(
            entreprise.id_client,
            date_debut=date(2024, 1, 1),
            date_fin=date(2024, 12, 31),
        )
    )
    repository.create(
        _abonnement(
            entreprise.id_client,
            date_debut=date(2026, 1, 1),
            date_fin=date(2026, 12, 31),
        )
    )
    db.commit()

    resultat = repository.par_client_entreprise(entreprise.id_client)

    assert resultat[0].date_debut == date(2026, 1, 1)
    assert resultat[1].date_debut == date(2024, 1, 1)
