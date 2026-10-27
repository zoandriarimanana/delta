"""Tests du service BENEFICIAIRE.

Sur `session_postgres` et non SQLite : `BENEFICIAIRE` référence `ABONNEMENT`,
qui porte une contrainte d'exclusion `EXCLUDE USING gist` que SQLite ne sait
pas créer. Même raisonnement que `test_abonnement_service.py`.
"""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.core.security import hacher_mot_de_passe
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.beneficiaire import StatutBeneficiaire
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.schemas.beneficiaire import BeneficiaireCreate, BeneficiaireUpdate
from app.services.beneficiaire_service import BeneficiaireService

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> BeneficiaireService:
    return BeneficiaireService(db)


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


def _charge_utile(
    id_abonnement: int, badge: str = "B001", **overrides: object
) -> BeneficiaireCreate:
    donnees = {
        "id_abonnement": id_abonnement,
        "nom": "Rakoto",
        "prenom": "Jean",
        "identifiant_badge": badge,
    }
    donnees.update(overrides)
    return BeneficiaireCreate(**donnees)


# --- creer (client) ----------------------------------------------------------


def test_creer_pour_son_abonnement(db: Session, service: BeneficiaireService) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)

    beneficiaire = service.creer(_charge_utile(abonnement.id_abonnement), entreprise)

    assert beneficiaire.id_abonnement == abonnement.id_abonnement


def test_creer_refuse_l_abonnement_d_une_autre_entreprise(
    db: Session, service: BeneficiaireService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement_b = _abonnement(db, entreprise_b.id_client)

    with pytest.raises(RessourceIntrouvable):
        service.creer(_charge_utile(abonnement_b.id_abonnement), entreprise_a)


def test_creer_sur_un_abonnement_archive_donne_ressource_introuvable(
    db: Session, service: BeneficiaireService
) -> None:
    """404 et non 422 : `get_by_id` filtre l'archivage, l'abonnement archivé
    est donc indiscernable d'un abonnement inexistant — même raisonnement que
    `AbonnementService.obtenir_du_client_entreprise`."""
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    abonnement.supprime_le = datetime.now(UTC)
    db.flush()

    with pytest.raises(RessourceIntrouvable):
        service.creer(_charge_utile(abonnement.id_abonnement), entreprise)


def test_creer_refuse_un_abonnement_expire(
    db: Session, service: BeneficiaireService
) -> None:
    entreprise = _entreprise(db)
    hier = date.today() - timedelta(days=1)
    abonnement = _abonnement(
        db,
        entreprise.id_client,
        date_debut=hier - timedelta(days=365),
        date_fin=hier,
    )

    with pytest.raises(ReferenceInvalide):
        service.creer(_charge_utile(abonnement.id_abonnement), entreprise)


# --- creer_administration ------------------------------------------------


def test_creer_administration(db: Session, service: BeneficiaireService) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)

    beneficiaire = service.creer_administration(_charge_utile(abonnement.id_abonnement))

    assert beneficiaire.id_abonnement == abonnement.id_abonnement


def test_creer_administration_abonnement_inexistant_donne_reference_invalide(
    service: BeneficiaireService,
) -> None:
    with pytest.raises(ReferenceInvalide):
        service.creer_administration(_charge_utile(999))


# --- Lecture avec portee -----------------------------------------------------


def test_obtenir_du_client_entreprise_refuse_celui_d_une_autre(
    db: Session, service: BeneficiaireService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement_a = _abonnement(db, entreprise_a.id_client)
    beneficiaire = service.creer(
        _charge_utile(abonnement_a.id_abonnement), entreprise_a
    )

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_du_client_entreprise(beneficiaire.id_beneficiaire, entreprise_b)


def test_lister_du_client_entreprise_traverse_tous_ses_abonnements(
    db: Session, service: BeneficiaireService
) -> None:
    entreprise = _entreprise(db)
    abonnement_1 = _abonnement(db, entreprise.id_client)
    abonnement_2 = _abonnement(
        db,
        entreprise.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    service.creer(_charge_utile(abonnement_1.id_abonnement, "B001"), entreprise)
    service.creer(_charge_utile(abonnement_2.id_abonnement, "B002"), entreprise)

    resultat = service.lister_du_client_entreprise(entreprise)

    assert len(resultat) == 2


# --- Modification et suppression --------------------------------------------


def test_modifier_change_le_statut(db: Session, service: BeneficiaireService) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    beneficiaire = service.creer(_charge_utile(abonnement.id_abonnement), entreprise)

    resultat = service.modifier(
        beneficiaire.id_beneficiaire,
        BeneficiaireUpdate(statut=StatutBeneficiaire.SUSPENDU),
    )

    assert resultat.statut == StatutBeneficiaire.SUSPENDU


def test_supprimer_archive(db: Session, service: BeneficiaireService) -> None:
    entreprise = _entreprise(db)
    abonnement = _abonnement(db, entreprise.id_client)
    beneficiaire = service.creer(_charge_utile(abonnement.id_abonnement), entreprise)

    service.supprimer(beneficiaire.id_beneficiaire)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(beneficiaire.id_beneficiaire)


# --- lister() : filtre optionnel par abonnement -----------------------------


def test_lister_sans_filtre_retourne_tous_les_beneficiaires(
    db: Session, service: BeneficiaireService
) -> None:
    """Sans `id_abonnement` : comportement inchangé, aucune régression."""
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement_a = _abonnement(db, entreprise_a.id_client)
    abonnement_b = _abonnement(
        db,
        entreprise_b.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    service.creer(_charge_utile(abonnement_a.id_abonnement, "B001"), entreprise_a)
    service.creer(_charge_utile(abonnement_b.id_abonnement, "B002"), entreprise_b)

    resultat = service.lister()

    assert len(resultat) == 2


def test_lister_avec_filtre_ne_retourne_que_l_abonnement_designe(
    db: Session, service: BeneficiaireService
) -> None:
    entreprise_a = _entreprise(db, "1111111111")
    entreprise_b = _entreprise(db, "2222222222")
    abonnement_a = _abonnement(db, entreprise_a.id_client)
    abonnement_b = _abonnement(
        db,
        entreprise_b.id_client,
        date_debut=date(2027, 1, 1),
        date_fin=date(2027, 12, 31),
    )
    service.creer(_charge_utile(abonnement_a.id_abonnement, "B001"), entreprise_a)
    service.creer(_charge_utile(abonnement_b.id_abonnement, "B002"), entreprise_b)

    resultat = service.lister(id_abonnement=abonnement_a.id_abonnement)

    assert len(resultat) == 1
    assert resultat[0].identifiant_badge == "B001"
