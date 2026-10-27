"""Tests de l'authentification du PERSONNEL.

Trois refus partagent un seul message : adresse inconnue, mot de passe faux, et
compte sans mot de passe. Les distinguer révélerait quelles adresses figurent à
l'annuaire.
"""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import AuthentificationInvalide
from app.core.security import hacher_mot_de_passe
from app.models.personnel import FonctionPersonnel, Personnel
from app.schemas.auth import Connexion
from app.services.personnel_auth_service import PersonnelAuthService
from tests.conftest import creer_engine_sqlite

MOT_DE_PASSE = "motdepasse123"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Personnel.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> PersonnelAuthService:
    return PersonnelAuthService(db)


def _salarie(db: Session, email: str = "jean@delta.mg", **extra: object) -> Personnel:
    parametres: dict = {
        "nom": "Rakoto",
        "prenom": "Jean",
        "fonction": FonctionPersonnel.LIVREUR,
        "email": email,
        "mot_de_passe": hacher_mot_de_passe(MOT_DE_PASSE),
    }
    parametres.update(extra)
    personnel = Personnel(**parametres)
    db.add(personnel)
    db.commit()
    return personnel


def _identifiants(email: str = "jean@delta.mg", mot_de_passe: str = MOT_DE_PASSE):
    return Connexion(email=email, mot_de_passe=mot_de_passe)


def test_connexion_valide(db: Session, service: PersonnelAuthService) -> None:
    salarie = _salarie(db)

    assert service.authentifier(_identifiants()).id_personnel == salarie.id_personnel


def test_mot_de_passe_faux_refuse(db: Session, service: PersonnelAuthService) -> None:
    _salarie(db)

    with pytest.raises(AuthentificationInvalide):
        service.authentifier(_identifiants(mot_de_passe="mauvais_mot_de_passe"))


def test_adresse_inconnue_refusee(service: PersonnelAuthService) -> None:
    with pytest.raises(AuthentificationInvalide):
        service.authentifier(_identifiants())


def test_compte_sans_mot_de_passe_refuse(
    db: Session, service: PersonnelAuthService
) -> None:
    """`NULL` signifie « ne se connecte pas ».

    Un cuisinier peut n'avoir aucun besoin d'un compte : ce n'est pas une donnée
    manquante, c'est un état légitime.
    """
    _salarie(db, mot_de_passe=None)

    with pytest.raises(AuthentificationInvalide):
        service.authentifier(_identifiants())


def test_salarie_archive_refuse(db: Session, service: PersonnelAuthService) -> None:
    """`get_by_email` filtre les archivés : un départ ferme l'accès."""
    salarie = _salarie(db)
    salarie.supprime_le = datetime.now(UTC)
    db.commit()

    with pytest.raises(AuthentificationInvalide):
        service.authentifier(_identifiants())


def test_le_message_est_le_meme_dans_tous_les_cas(
    db: Session, service: PersonnelAuthService
) -> None:
    """Un message distinct par cause permettrait d'énumérer l'annuaire.

    « Ce compte n'a pas de mot de passe » confirmerait à lui seul l'existence
    d'un salarié à cette adresse.
    """
    _salarie(db, email="avec@delta.mg")
    _salarie(db, email="sans@delta.mg", mot_de_passe=None)

    messages = set()
    for identifiants in (
        _identifiants("inconnu@delta.mg"),
        _identifiants("avec@delta.mg", "mauvais_mot_de_passe"),
        _identifiants("sans@delta.mg"),
    ):
        with pytest.raises(AuthentificationInvalide) as capture:
            service.authentifier(identifiants)
        messages.add(str(capture.value))

    assert len(messages) == 1


def test_une_adresse_reutilisee_apres_archivage_authentifie_le_bon_compte(
    db: Session, service: PersonnelAuthService
) -> None:
    """Le piège du soft delete : l'index d'unicité est partiel.

    Le départ puis le remplacement d'un salarié laisse deux lignes de même
    adresse. Sans le filtre de `get_by_email`, la requête lèverait
    `MultipleResultsFound` — ou pire, authentifierait l'ancien.
    """
    ancien = _salarie(db)
    ancien.supprime_le = datetime.now(UTC)
    db.commit()
    nouveau = _salarie(db)

    authentifie = service.authentifier(_identifiants())

    assert authentifie.id_personnel == nouveau.id_personnel
    assert authentifie.id_personnel != ancien.id_personnel
