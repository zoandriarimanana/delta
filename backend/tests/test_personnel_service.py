"""Tests du service PERSONNEL."""

from collections.abc import Iterator
from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.models.personnel import FonctionPersonnel, Personnel
from app.schemas.personnel import PersonnelCreate, PersonnelUpdate
from app.services.personnel_service import (
    CONTRAINTE_EMAIL_UNIQUE,
    PersonnelService,
)
from tests.conftest import creer_engine_sqlite, erreur_integrite_postgres


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Personnel.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> PersonnelService:
    return PersonnelService(db)


def _donnees(
    email: str = "jean@delta.mg",
    fonction: FonctionPersonnel = FonctionPersonnel.LIVREUR,
    **extra: object,
) -> PersonnelCreate:
    return PersonnelCreate(
        nom="Rakoto", prenom="Jean", fonction=fonction, email=email, **extra
    )


# --- Création -----------------------------------------------------------------


def test_creation(service: PersonnelService) -> None:
    personnel = service.creer(_donnees())

    assert personnel.id_personnel is not None
    assert personnel.fonction is FonctionPersonnel.LIVREUR


@pytest.mark.parametrize("fonction", list(FonctionPersonnel))
def test_toutes_les_fonctions_sont_traitees_pareil(
    service: PersonnelService, fonction: FonctionPersonnel
) -> None:
    """Aucune fonction n'est un cas particulier — critère central de l'issue."""
    personnel = service.creer(_donnees(f"{fonction.value.lower()}@delta.mg", fonction))

    assert personnel.fonction is fonction


def test_fonction_hors_domaine_refusee_par_le_schema() -> None:
    """422 avant la base : l'énumération fait foi côté API."""
    with pytest.raises(ValueError):
        PersonnelCreate(
            nom="Rakoto", prenom="Jean", fonction="Plombier", email="j@delta.mg"
        )


def test_casse_differente_refusee(service: PersonnelService) -> None:
    """« livreur » n'est pas « Livreur ».

    C'est précisément ce qu'une chaîne libre laissait passer, et ce que les
    règles d'affectation des sprints suivants compareront.
    """
    with pytest.raises(ValueError):
        PersonnelCreate(
            nom="Rakoto", prenom="Jean", fonction="livreur", email="j@delta.mg"
        )


def test_champs_optionnels_conserves(service: PersonnelService) -> None:
    personnel = service.creer(
        _donnees(
            fonction=FonctionPersonnel.FORMATEUR,
            telephone="+261340000000",
            date_embauche=date(2024, 3, 1),
            specialite="Pâtisserie",
        )
    )

    assert personnel.specialite == "Pâtisserie"
    assert personnel.date_embauche == date(2024, 3, 1)


def test_est_administrateur_defaut_faux(service: PersonnelService) -> None:
    assert service.creer(_donnees()).est_administrateur is False


def test_le_service_ne_peut_pas_accorder_le_droit_d_administration(
    service: PersonnelService,
) -> None:
    """`est_administrateur` n'est pas dans `PersonnelCreate`, donc pas dans le
    `model_dump()` passé au repository.

    Le seul chemin qui l'écrit est le script d'amorçage — voir
    `test_creer_admin.py`. L'orthogonalité entre droit et métier y est vérifiée.
    """
    personnel = service.creer(_donnees(fonction=FonctionPersonnel.FORMATEUR))

    assert personnel.fonction is FonctionPersonnel.FORMATEUR
    assert personnel.est_administrateur is False


# --- Unicité de l'e-mail ------------------------------------------------------


def test_email_deja_pris_leve_un_conflit(service: PersonnelService) -> None:
    service.creer(_donnees())

    with pytest.raises(ConflitMetier):
        service.creer(_donnees())


def test_email_libere_par_archivage_est_reutilisable(
    service: PersonnelService,
) -> None:
    """Départ puis retour d'un salarié : l'index est partiel, pas global."""
    premier = service.creer(_donnees())
    service.supprimer(premier.id_personnel)

    second = service.creer(_donnees())

    assert second.id_personnel != premier.id_personnel


def test_conflit_email_traduit_depuis_l_integrity_error(
    service: PersonnelService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La course que le pré-contrôle ne couvre pas.

    Entre la vérification et le `commit`, une autre transaction a pu prendre
    l'adresse. La branche est exercée avec une erreur nommée comme PostgreSQL la
    remonte — SQLite ne fournit pas `diag.constraint_name`.
    """

    def echouer(*_: object, **__: object) -> None:
        raise erreur_integrite_postgres(CONTRAINTE_EMAIL_UNIQUE)

    monkeypatch.setattr(service.db, "commit", echouer)

    with pytest.raises(ConflitMetier):
        service.creer(_donnees())


def test_autre_violation_n_est_pas_traduite_en_conflit(
    service: PersonnelService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Une contrainte inconnue doit remonter telle quelle, pas en 409 trompeur."""

    def echouer(*_: object, **__: object) -> None:
        raise erreur_integrite_postgres("ck_une_autre_contrainte")

    monkeypatch.setattr(service.db, "commit", echouer)

    with pytest.raises(IntegrityError):
        service.creer(_donnees())


# --- Lecture ------------------------------------------------------------------


def test_obtenir_inconnu_leve_introuvable(service: PersonnelService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_obtenir_archive_leve_introuvable(service: PersonnelService) -> None:
    """Un archivé est invisible, exactement comme s'il n'avait jamais existé."""
    personnel = service.creer(_donnees())
    service.supprimer(personnel.id_personnel)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(personnel.id_personnel)


def test_lister_filtre_par_fonction(service: PersonnelService) -> None:
    service.creer(_donnees("livreur@delta.mg", FonctionPersonnel.LIVREUR))
    service.creer(_donnees("cuisinier@delta.mg", FonctionPersonnel.CUISINIER))

    livreurs = service.lister(FonctionPersonnel.LIVREUR)

    assert [p.email for p in livreurs] == ["livreur@delta.mg"]


def test_lister_sans_filtre_retourne_tout(service: PersonnelService) -> None:
    service.creer(_donnees("livreur@delta.mg", FonctionPersonnel.LIVREUR))
    service.creer(_donnees("cuisinier@delta.mg", FonctionPersonnel.CUISINIER))

    assert len(service.lister()) == 2


# --- Modification -------------------------------------------------------------


def test_modification_partielle_ne_touche_que_les_champs_fournis(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees(specialite="Pâtisserie"))

    service.modifier(personnel.id_personnel, PersonnelUpdate(nom="Rabe"))

    assert personnel.nom == "Rabe"
    assert personnel.specialite == "Pâtisserie"


def test_la_modification_ne_promeut_pas_administrateur(
    service: PersonnelService,
) -> None:
    """Une modification ne doit pas être une porte dérobée vers ce que la
    création interdit.

    `PersonnelUpdate` ignore la clé inconnue : la mise à jour aboutit, mais sans
    toucher au droit.
    """
    personnel = service.creer(_donnees())

    service.modifier(
        personnel.id_personnel,
        PersonnelUpdate.model_validate({"nom": "Rabe", "est_administrateur": True}),
    )

    assert personnel.nom == "Rabe"
    assert personnel.est_administrateur is False


def test_le_service_ne_peut_pas_poser_de_mot_de_passe(
    service: PersonnelService,
) -> None:
    """Créer un compte de connexion n'est pas une opération d'annuaire."""
    personnel = service.creer(
        PersonnelCreate.model_validate(
            {
                "nom": "Rakoto",
                "prenom": "Jean",
                "fonction": "Livreur",
                "email": "jean@delta.mg",
                "mot_de_passe": "MotDePasse123456",
            }
        )
    )

    assert personnel.mot_de_passe is None


def test_changement_de_fonction(service: PersonnelService) -> None:
    personnel = service.creer(_donnees())

    service.modifier(
        personnel.id_personnel,
        PersonnelUpdate(fonction=FonctionPersonnel.RECEPTIONNISTE),
    )

    assert personnel.fonction is FonctionPersonnel.RECEPTIONNISTE


def test_modifier_vers_un_email_pris_leve_un_conflit(
    service: PersonnelService,
) -> None:
    service.creer(_donnees("premier@delta.mg"))
    second = service.creer(_donnees("second@delta.mg"))

    with pytest.raises(ConflitMetier):
        service.modifier(second.id_personnel, PersonnelUpdate(email="premier@delta.mg"))


def test_reattribuer_sa_propre_adresse_n_est_pas_un_conflit(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees())

    service.modifier(
        personnel.id_personnel, PersonnelUpdate(email="jean@delta.mg", nom="Rabe")
    )

    assert personnel.nom == "Rabe"


def test_modifier_inconnu_leve_introuvable(service: PersonnelService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.modifier(99999, PersonnelUpdate(nom="Rabe"))


# --- Archivage et restauration ------------------------------------------------


def test_suppression_archive_sans_effacer(
    service: PersonnelService, db: Session
) -> None:
    """Aucun `DELETE` SQL : la ligne reste, horodatée."""
    personnel = service.creer(_donnees())

    service.supprimer(personnel.id_personnel)

    archive = service.personnels.get_by_id(
        personnel.id_personnel, inclure_supprimes=True
    )
    assert archive is not None
    assert archive.supprime_le is not None


def test_supprimer_inconnu_leve_introuvable(service: PersonnelService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.supprimer(99999)


def test_restauration(service: PersonnelService) -> None:
    personnel = service.creer(_donnees())
    service.supprimer(personnel.id_personnel)

    service.restaurer(personnel.id_personnel)

    assert service.obtenir(personnel.id_personnel) is not None


def test_restauration_est_idempotente(service: PersonnelService) -> None:
    personnel = service.creer(_donnees())

    assert service.restaurer(personnel.id_personnel).id_personnel == (
        personnel.id_personnel
    )


def test_restauration_refusee_si_l_adresse_a_ete_reattribuee(
    service: PersonnelService,
) -> None:
    """Le cas que rend possible l'index partiel, et qu'il faut traduire.

    L'adresse libérée par l'archivage a été reprise par une ligne active :
    restaurer créerait deux actifs de même adresse.
    """
    parti = service.creer(_donnees())
    service.supprimer(parti.id_personnel)
    service.creer(_donnees())

    with pytest.raises(ConflitMetier):
        service.restaurer(parti.id_personnel)


def test_restaurer_inconnu_leve_introuvable(service: PersonnelService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.restaurer(99999)
