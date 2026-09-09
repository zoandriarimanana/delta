"""Tests du service PERSONNEL."""

import io
from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflitMetier, ErreurMetier, RessourceIntrouvable
from app.core.security import hacher_mot_de_passe, verifier_mot_de_passe
from app.models.personnel import FonctionPersonnel, Personnel
from app.schemas.personnel import PersonnelCreate, PersonnelUpdate
from app.services.personnel_service import (
    CONTRAINTE_EMAIL_UNIQUE,
    DOMAINE_ANONYME,
    MENTION_ANONYME,
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


@pytest.fixture(autouse=True)
def _dossier_photos_isole(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Redirige le stockage des photos vers un dossier temporaire par test.

    Sans ça, les tests écriraient dans le vrai `Settings.PHOTO_STORAGE_DIR`
    (relatif au répertoire de travail), se pollueraient les uns les autres et
    laisseraient des fichiers derrière eux à chaque run.
    """
    monkeypatch.setattr(settings, "PHOTO_STORAGE_DIR", str(tmp_path))


def _octets_image(format_: str = "PNG") -> bytes:
    """Une image PNG/JPEG minimale mais réelle — Pillow doit pouvoir la lire."""
    tampon = io.BytesIO()
    Image.new("RGB", (8, 8), color="red").save(tampon, format=format_)
    return tampon.getvalue()


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


# --- Anonymisation -------------------------------------------------------------


def test_anonymisation_efface_les_donnees_personnelles(
    service: PersonnelService,
) -> None:
    personnel = service.creer(
        _donnees(telephone="+261340000000", specialite="Pâtisserie")
    )

    service.anonymiser(personnel.id_personnel)

    assert personnel.nom == MENTION_ANONYME
    assert personnel.prenom == MENTION_ANONYME
    assert personnel.telephone is None
    assert personnel.specialite is None
    assert DOMAINE_ANONYME in personnel.email


def test_anonymisation_conserve_la_ligne_et_son_identifiant(
    service: PersonnelService,
) -> None:
    """La ligne reste : `LIVRAISON` et `SESSION_FORMATION` la référencent, et une
    livraison honorée est une trace d'exécution."""
    personnel = service.creer(_donnees())
    identifiant = personnel.id_personnel

    service.anonymiser(identifiant)

    assert service.personnels.get_by_id(identifiant, inclure_supprimes=True) is not None


def test_anonymisation_conserve_fonction_et_date_d_embauche(
    service: PersonnelService,
) -> None:
    """Ni l'une ni l'autre n'identifie quelqu'un, et les deux restent utiles à
    l'exploitation des enregistrements liés."""
    personnel = service.creer(
        _donnees(fonction=FonctionPersonnel.FORMATEUR, date_embauche=date(2024, 3, 1))
    )

    service.anonymiser(personnel.id_personnel)

    assert personnel.fonction is FonctionPersonnel.FORMATEUR
    assert personnel.date_embauche == date(2024, 3, 1)


def test_anonymisation_archive_aussi(service: PersonnelService) -> None:
    """Anonymiser et archiver ne sont pas deux mécanismes concurrents."""
    personnel = service.creer(_donnees())

    service.anonymiser(personnel.id_personnel)

    assert personnel.supprime_le is not None
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(personnel.id_personnel)


def test_anonymisation_retire_le_droit_d_administration(
    db: Session, service: PersonnelService
) -> None:
    """Un compte anonymisé ne doit plus porter aucun droit."""
    personnel = service.creer(_donnees())
    personnel.est_administrateur = True
    db.commit()

    service.anonymiser(personnel.id_personnel)

    assert personnel.est_administrateur is False


def test_anonymisation_rend_la_connexion_impossible(
    db: Session, service: PersonnelService
) -> None:
    """Le mot de passe est remplacé par le haché d'un secret que personne ne
    détient — pas simplement effacé."""
    personnel = service.creer(_donnees())
    personnel.mot_de_passe = hacher_mot_de_passe("motdepasse123")
    db.commit()
    ancienne_empreinte = personnel.mot_de_passe

    service.anonymiser(personnel.id_personnel)

    assert personnel.mot_de_passe is not None
    assert personnel.mot_de_passe != ancienne_empreinte
    assert not verifier_mot_de_passe("motdepasse123", personnel.mot_de_passe)


def test_adresse_anonyme_non_soumissible(service: PersonnelService) -> None:
    """`delta.invalid` est réservé par la RFC 2606 : `EmailStr` la refuse en
    entrée, personne ne peut donc la soumettre pour usurper le compte."""
    personnel = service.creer(_donnees())
    service.anonymiser(personnel.id_personnel)

    with pytest.raises(ValueError):
        PersonnelCreate(
            nom="X", prenom="Y", fonction=FonctionPersonnel.AUTRE, email=personnel.email
        )


def test_anonymiser_un_inconnu_leve_introuvable(service: PersonnelService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.anonymiser(99999)


def test_anonymiser_un_deja_archive_reste_possible(service: PersonnelService) -> None:
    """L'archivage précède souvent la demande d'effacement, pas l'inverse."""
    personnel = service.creer(_donnees())
    service.supprimer(personnel.id_personnel)

    service.anonymiser(personnel.id_personnel)

    assert personnel.nom == MENTION_ANONYME


# --- Photo de profil -----------------------------------------------------------


def test_remplacer_photo_pose_la_colonne_et_ecrit_le_fichier(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees())

    mis_a_jour = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )

    assert mis_a_jour.photo_chemin is not None
    assert mis_a_jour.photo_chemin.endswith(".png")
    assert (Path(settings.PHOTO_STORAGE_DIR) / mis_a_jour.photo_chemin).exists()


def test_remplacer_photo_jpeg_stocke_l_extension_jpg(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees())

    mis_a_jour = service.remplacer_photo(
        personnel.id_personnel, _octets_image("JPEG"), "image/jpeg"
    )

    assert mis_a_jour.photo_chemin is not None
    assert mis_a_jour.photo_chemin.endswith(".jpg")


def test_remplacer_photo_nom_de_fichier_ignore_toute_entree_du_client(
    service: PersonnelService,
) -> None:
    """Le nom stocké est un UUID généré côté serveur — rien de ce que le
    client a pu suggérer (nom de fichier, chemin) n'y transite."""
    personnel = service.creer(_donnees())

    mis_a_jour = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )

    assert mis_a_jour.photo_chemin is not None
    assert "/" not in mis_a_jour.photo_chemin
    assert ".." not in mis_a_jour.photo_chemin


@pytest.mark.parametrize(
    "type_mime", [None, "text/plain", "application/pdf", "image/gif"]
)
def test_remplacer_photo_refuse_un_type_mime_non_accepte(
    service: PersonnelService, type_mime: str | None
) -> None:
    personnel = service.creer(_donnees())

    with pytest.raises(ErreurMetier):
        service.remplacer_photo(personnel.id_personnel, _octets_image("PNG"), type_mime)


def test_remplacer_photo_refuse_un_contenu_qui_n_est_pas_une_image(
    service: PersonnelService,
) -> None:
    """Le `Content-Type` déclaré ne suffit pas : le contenu réel est vérifié
    par Pillow, pas seulement l'en-tête que le client peut mentir."""
    personnel = service.creer(_donnees())

    with pytest.raises(ErreurMetier):
        service.remplacer_photo(
            personnel.id_personnel, b"ceci n'est pas une image", "image/png"
        )

    # Rien n'a été écrit sur disque, ni en base.
    assert list(Path(settings.PHOTO_STORAGE_DIR).iterdir()) == []
    assert service.obtenir(personnel.id_personnel).photo_chemin is None


def test_remplacer_photo_refuse_une_taille_excessive(service: PersonnelService) -> None:
    personnel = service.creer(_donnees())
    contenu_trop_gros = _octets_image("PNG") + b"\0" * (2 * 1024 * 1024)

    with pytest.raises(ErreurMetier):
        service.remplacer_photo(personnel.id_personnel, contenu_trop_gros, "image/png")


def test_remplacer_photo_supprime_l_ancien_fichier_au_remplacement(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees())
    premiere = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )
    # `premiere` et `personnel` sont le **même objet** SQLAlchemy : son
    # attribut serait relu muté après le second appel. On fige donc le nom de
    # fichier en chaîne, avant cet appel.
    premier_nom_fichier = premiere.photo_chemin
    assert premier_nom_fichier is not None
    ancien_chemin = Path(settings.PHOTO_STORAGE_DIR) / premier_nom_fichier

    seconde = service.remplacer_photo(
        personnel.id_personnel, _octets_image("JPEG"), "image/jpeg"
    )

    assert seconde.photo_chemin != premier_nom_fichier
    assert not ancien_chemin.exists()
    assert (Path(settings.PHOTO_STORAGE_DIR) / seconde.photo_chemin).exists()


def test_remplacer_photo_sur_un_inconnu_leve_introuvable(
    service: PersonnelService,
) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.remplacer_photo(99999, _octets_image("PNG"), "image/png")


def test_supprimer_photo_efface_le_fichier_et_la_colonne(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees())
    avec_photo = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )
    chemin_fichier = Path(settings.PHOTO_STORAGE_DIR) / avec_photo.photo_chemin  # type: ignore[operator]

    sans_photo = service.supprimer_photo(personnel.id_personnel)

    assert sans_photo.photo_chemin is None
    assert not chemin_fichier.exists()


def test_supprimer_photo_sans_photo_est_sans_effet(service: PersonnelService) -> None:
    """Idempotent — même traitement que `restaurer()` sur un membre déjà actif."""
    personnel = service.creer(_donnees())

    resultat = service.supprimer_photo(personnel.id_personnel)

    assert resultat.photo_chemin is None


def test_chemin_photo_leve_introuvable_sans_photo(service: PersonnelService) -> None:
    personnel = service.creer(_donnees())

    with pytest.raises(RessourceIntrouvable):
        service.chemin_photo(personnel.id_personnel)


def test_chemin_photo_retourne_le_fichier_reellement_ecrit(
    service: PersonnelService,
) -> None:
    personnel = service.creer(_donnees())
    mis_a_jour = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )

    chemin = service.chemin_photo(personnel.id_personnel)

    assert chemin.exists()
    assert chemin.name == mis_a_jour.photo_chemin


def test_anonymisation_efface_aussi_la_photo(service: PersonnelService) -> None:
    """La photo est une donnée personnelle au même titre que le nom ou
    l'e-mail : `anonymiser()` doit la traiter de même."""
    personnel = service.creer(_donnees())
    avec_photo = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )
    chemin_fichier = Path(settings.PHOTO_STORAGE_DIR) / avec_photo.photo_chemin  # type: ignore[operator]

    service.anonymiser(personnel.id_personnel)

    assert personnel.photo_chemin is None
    assert not chemin_fichier.exists()


def test_archivage_simple_ne_touche_pas_a_la_photo(service: PersonnelService) -> None:
    """Contrairement à `anonymiser()` : l'archivage reste réversible
    (`restaurer()`), et une restauration qui ferait perdre la photo serait
    une perte de donnée non voulue par la seule réversibilité de
    l'archivage — cf. `docs/mld.md`."""
    personnel = service.creer(_donnees())
    avec_photo = service.remplacer_photo(
        personnel.id_personnel, _octets_image("PNG"), "image/png"
    )
    chemin_fichier = Path(settings.PHOTO_STORAGE_DIR) / avec_photo.photo_chemin  # type: ignore[operator]

    service.supprimer(personnel.id_personnel)

    assert personnel.photo_chemin == avec_photo.photo_chemin
    assert chemin_fichier.exists()
