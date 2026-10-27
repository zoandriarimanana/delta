"""Tests du repository BENEFICIAIRE.

Sur `session_postgres` et non SQLite : `BENEFICIAIRE` référence `ABONNEMENT`,
qui porte une contrainte d'exclusion `EXCLUDE USING gist` que SQLite ne sait
pas créer. Même raisonnement que `test_abonnement_repository.py`.
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.beneficiaire import StatutBeneficiaire
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.repositories.beneficiaire_repository import BeneficiaireRepository

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def repository(db: Session) -> BeneficiaireRepository:
    return BeneficiaireRepository(db)


def _entreprise(db: Session, numero: str = "1111111111") -> ClientEntreprise:
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
    return client.entreprise


def _abonnement(
    db: Session, id_client_entreprise: int, **overrides: object
) -> Abonnement:
    donnees = {
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 12, 31),
        "type_facturation": TypeFacturation.FORFAIT,
        "mode_suivi": ModeSuivi.INDIVIDUEL,
        "tarif_forfait": 500000,
        "id_client_entreprise": id_client_entreprise,
    }
    donnees.update(overrides)
    abonnement = Abonnement(**donnees)
    db.add(abonnement)
    db.flush()
    return abonnement


def _beneficiaire(id_abonnement: int, badge: str, **overrides: object) -> dict:
    donnees = {
        "nom": "Rakoto",
        "prenom": "Jean",
        "identifiant_badge": badge,
        "statut": StatutBeneficiaire.ACTIF,
        "id_abonnement": id_abonnement,
    }
    donnees.update(overrides)
    return donnees


def test_creer_et_obtenir(db: Session, repository: BeneficiaireRepository) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)

    beneficiaire = repository.create(_beneficiaire(abonnement.id_abonnement, "B001"))
    db.commit()

    trouve = repository.get_by_id(beneficiaire.id_beneficiaire)
    assert trouve is not None
    assert trouve.identifiant_badge == "B001"


def test_par_abonnement_ne_retourne_que_les_siens(
    db: Session, repository: BeneficiaireRepository
) -> None:
    entreprise = _entreprise(db)
    abonnement_a = _abonnement(db, entreprise.id_client)
    abonnement_b = _abonnement(
        db,
        entreprise.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    repository.create(_beneficiaire(abonnement_a.id_abonnement, "B001"))
    repository.create(_beneficiaire(abonnement_b.id_abonnement, "B002"))
    db.commit()

    resultat = repository.par_abonnement(abonnement_a.id_abonnement)

    assert len(resultat) == 1
    assert resultat[0].identifiant_badge == "B001"


def test_par_abonnement_exclut_les_archives_par_defaut(
    db: Session, repository: BeneficiaireRepository
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    beneficiaire = repository.create(_beneficiaire(abonnement.id_abonnement, "B001"))
    db.commit()
    repository.delete(beneficiaire)
    db.commit()

    assert repository.par_abonnement(abonnement.id_abonnement) == []
    assert (
        len(repository.par_abonnement(abonnement.id_abonnement, inclure_supprimes=True))
        == 1
    )


def test_par_client_entreprise_traverse_tous_ses_abonnements(
    db: Session, repository: BeneficiaireRepository
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement_a1 = _abonnement(db, entreprise_a.id_client)
    abonnement_a2 = _abonnement(
        db,
        entreprise_a.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    abonnement_b = _abonnement(db, entreprise_b.id_client)
    repository.create(_beneficiaire(abonnement_a1.id_abonnement, "B001"))
    repository.create(_beneficiaire(abonnement_a2.id_abonnement, "B002"))
    repository.create(_beneficiaire(abonnement_b.id_abonnement, "B003"))
    db.commit()

    resultat = repository.par_client_entreprise(entreprise_a.id_client)

    assert {b.identifiant_badge for b in resultat} == {"B001", "B002"}


def test_badge_reattribuable_apres_archivage(
    db: Session, repository: BeneficiaireRepository
) -> None:
    """Index unique **partiel** : un badge archivé redevient disponible."""
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    premier = repository.create(_beneficiaire(abonnement.id_abonnement, "B001"))
    db.commit()
    repository.delete(premier)
    db.commit()

    second = repository.create(_beneficiaire(abonnement.id_abonnement, "B001"))
    db.commit()

    assert second.id_beneficiaire != premier.id_beneficiaire
