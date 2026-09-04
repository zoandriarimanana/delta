"""Tests du service CLIENT_ENTREPRISE (administration)."""

from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.services.client_entreprise_service import ClientEntrepriseService
from tests.conftest import creer_engine_sqlite

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Client.__table__, ClientEntreprise.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> ClientEntrepriseService:
    return ClientEntrepriseService(db)


def _entreprise(db: Session, numero: str, raison_sociale: str = "Société") -> Client:
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
    return client


def test_lister_retourne_les_entreprises_actives(
    db: Session, service: ClientEntrepriseService
) -> None:
    _entreprise(db, "1111111111", "Société A")
    _entreprise(db, "2222222222", "Société B")
    db.commit()

    resultat = service.lister()

    assert {e.raison_sociale for e in resultat} == {"Société A", "Société B"}


def test_lister_exclut_les_entreprises_archivees(
    db: Session, service: ClientEntrepriseService
) -> None:
    client = _entreprise(db, "1111111111", "Société A")
    db.commit()
    client.entreprise.supprime_le = client.date_creation_compte
    db.commit()

    resultat = service.lister()

    assert resultat == []


def test_lister_sans_entreprise_retourne_une_liste_vide(
    service: ClientEntrepriseService,
) -> None:
    assert service.lister() == []
