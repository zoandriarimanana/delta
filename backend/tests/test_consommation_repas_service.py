"""Tests du service CONSOMMATION_REPAS.

Sur `session_postgres` et non SQLite : `CONSOMMATION_REPAS` référence
`ABONNEMENT`, qui porte une contrainte d'exclusion `EXCLUDE USING gist` que
SQLite ne sait pas créer.
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.core.security import hacher_mot_de_passe
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.beneficiaire import Beneficiaire, StatutBeneficiaire
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.schemas.consommation_repas import (
    ConsommationRepasCreate,
    ConsommationRepasUpdate,
)
from app.services.consommation_repas_service import ConsommationRepasService

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> ConsommationRepasService:
    return ConsommationRepasService(db)


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


def _beneficiaire(db: Session, id_abonnement: int, badge: str = "B001") -> Beneficiaire:
    beneficiaire = Beneficiaire(
        nom="Rakoto",
        prenom="Jean",
        identifiant_badge=badge,
        statut=StatutBeneficiaire.ACTIF,
        id_abonnement=id_abonnement,
    )
    db.add(beneficiaire)
    db.flush()
    return beneficiaire


# --- Cohérence mode_suivi / id_beneficiaire ---------------------------------


def test_enregistrer_en_mode_global_sans_beneficiaire(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client, mode_suivi=ModeSuivi.GLOBAL)

    consommation = service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2026, 3, 1), id_abonnement=abonnement.id_abonnement
        )
    )

    assert consommation.id_beneficiaire is None


def test_enregistrer_en_mode_global_avec_beneficiaire_est_refuse(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client, mode_suivi=ModeSuivi.GLOBAL)
    beneficiaire = _beneficiaire(db, abonnement.id_abonnement)

    with pytest.raises(ReferenceInvalide):
        service.enregistrer(
            ConsommationRepasCreate(
                date_consommation=date(2026, 3, 1),
                id_abonnement=abonnement.id_abonnement,
                id_beneficiaire=beneficiaire.id_beneficiaire,
            )
        )


def test_enregistrer_en_mode_individuel_avec_beneficiaire(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client, mode_suivi=ModeSuivi.INDIVIDUEL)
    beneficiaire = _beneficiaire(db, abonnement.id_abonnement)

    consommation = service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2026, 3, 1),
            id_abonnement=abonnement.id_abonnement,
            id_beneficiaire=beneficiaire.id_beneficiaire,
        )
    )

    assert consommation.id_beneficiaire == beneficiaire.id_beneficiaire


def test_enregistrer_en_mode_individuel_sans_beneficiaire_est_refuse(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client, mode_suivi=ModeSuivi.INDIVIDUEL)

    with pytest.raises(ReferenceInvalide):
        service.enregistrer(
            ConsommationRepasCreate(
                date_consommation=date(2026, 3, 1),
                id_abonnement=abonnement.id_abonnement,
            )
        )


def test_enregistrer_avec_beneficiaire_d_un_autre_abonnement_est_refuse(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement_a = _abonnement(
        db, entreprise.id_client, mode_suivi=ModeSuivi.INDIVIDUEL
    )
    abonnement_b = _abonnement(
        db,
        entreprise.id_client,
        mode_suivi=ModeSuivi.INDIVIDUEL,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    beneficiaire_b = _beneficiaire(db, abonnement_b.id_abonnement)

    with pytest.raises(ReferenceInvalide):
        service.enregistrer(
            ConsommationRepasCreate(
                date_consommation=date(2026, 3, 1),
                id_abonnement=abonnement_a.id_abonnement,
                id_beneficiaire=beneficiaire_b.id_beneficiaire,
            )
        )


def test_enregistrer_sur_un_abonnement_inexistant_donne_reference_invalide(
    service: ConsommationRepasService,
) -> None:
    with pytest.raises(ReferenceInvalide):
        service.enregistrer(
            ConsommationRepasCreate(
                date_consommation=date(2026, 3, 1), id_abonnement=999
            )
        )


# --- Lecture avec portee -----------------------------------------------------


def test_obtenir_du_client_entreprise_refuse_celui_d_une_autre(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement_a = _abonnement(db, entreprise_a.id_client)
    consommation = service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2026, 3, 1), id_abonnement=abonnement_a.id_abonnement
        )
    )

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_du_client_entreprise(consommation.id_consommation, entreprise_b)


def test_lister_du_client_entreprise_traverse_tous_ses_abonnements(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement_1 = _abonnement(db, entreprise.id_client)
    abonnement_2 = _abonnement(
        db,
        entreprise.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2026, 3, 1), id_abonnement=abonnement_1.id_abonnement
        )
    )
    service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2027, 3, 1), id_abonnement=abonnement_2.id_abonnement
        )
    )

    resultat = service.lister_du_client_entreprise(entreprise)

    assert len(resultat) == 2


# --- Modification et suppression --------------------------------------------


def test_modifier_change_la_quantite(
    db: Session, service: ConsommationRepasService
) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    consommation = service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2026, 3, 1), id_abonnement=abonnement.id_abonnement
        )
    )

    resultat = service.modifier(
        consommation.id_consommation, ConsommationRepasUpdate(quantite=3)
    )

    assert resultat.quantite == 3


def test_supprimer_archive(db: Session, service: ConsommationRepasService) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    consommation = service.enregistrer(
        ConsommationRepasCreate(
            date_consommation=date(2026, 3, 1), id_abonnement=abonnement.id_abonnement
        )
    )

    service.supprimer(consommation.id_consommation)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(consommation.id_consommation)
