"""Tests du repository CONSOMMATION_REPAS.

Sur `session_postgres` et non SQLite : `CONSOMMATION_REPAS` référence
`ABONNEMENT`, qui porte une contrainte d'exclusion `EXCLUDE USING gist` que
SQLite ne sait pas créer.
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.repositories.consommation_repas_repository import (
    ConsommationRepasRepository,
)

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def repository(db: Session) -> ConsommationRepasRepository:
    return ConsommationRepasRepository(db)


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


def _abonnement(
    db: Session, id_client_entreprise: int, **overrides: object
) -> Abonnement:
    donnees = {
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 12, 31),
        "type_facturation": TypeFacturation.CONSOMMATION_REELLE,
        "mode_suivi": ModeSuivi.GLOBAL,
        "tarif_unitaire_repas": 2500,
        "id_client_entreprise": id_client_entreprise,
    }
    donnees.update(overrides)
    abonnement = Abonnement(**donnees)
    db.add(abonnement)
    db.flush()
    return abonnement


def _consommation(id_abonnement: int, quantite: int = 1, **overrides: object) -> dict:
    donnees = {
        "date_consommation": date(2026, 3, 1),
        "quantite": quantite,
        "id_abonnement": id_abonnement,
    }
    donnees.update(overrides)
    return donnees


def test_creer_et_obtenir(db: Session, repository: ConsommationRepasRepository) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)

    consommation = repository.create(_consommation(abonnement.id_abonnement))
    db.commit()

    trouve = repository.get_by_id(consommation.id_consommation)
    assert trouve is not None
    assert trouve.id_abonnement == abonnement.id_abonnement


def test_par_abonnement_ne_retourne_que_les_siennes(
    db: Session, repository: ConsommationRepasRepository
) -> None:
    entreprise = _entreprise(db)
    abonnement_a = _abonnement(db, entreprise.id_client)
    abonnement_b = _abonnement(
        db,
        entreprise.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    repository.create(_consommation(abonnement_a.id_abonnement))
    repository.create(_consommation(abonnement_b.id_abonnement))
    db.commit()

    resultat = repository.par_abonnement(abonnement_a.id_abonnement)

    assert len(resultat) == 1
    assert resultat[0].id_abonnement == abonnement_a.id_abonnement


def test_par_abonnement_exclut_les_archivees_par_defaut(
    db: Session, repository: ConsommationRepasRepository
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    consommation = repository.create(_consommation(abonnement.id_abonnement))
    db.commit()
    repository.delete(consommation)
    db.commit()

    assert repository.par_abonnement(abonnement.id_abonnement) == []
    assert (
        len(repository.par_abonnement(abonnement.id_abonnement, inclure_supprimes=True))
        == 1
    )


def test_total_quantite_additionne_les_consommations_actives(
    db: Session, repository: ConsommationRepasRepository
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    repository.create(_consommation(abonnement.id_abonnement, quantite=2))
    archivee = repository.create(_consommation(abonnement.id_abonnement, quantite=100))
    repository.create(_consommation(abonnement.id_abonnement, quantite=3))
    db.commit()
    repository.delete(archivee)
    db.commit()

    assert repository.total_quantite(abonnement.id_abonnement) == 5


def test_total_quantite_est_nul_sans_consommation(
    db: Session, repository: ConsommationRepasRepository
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)

    assert repository.total_quantite(abonnement.id_abonnement) == 0
