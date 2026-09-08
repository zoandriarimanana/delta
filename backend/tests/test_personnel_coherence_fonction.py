"""Tests du mécanisme partagé de cohérence de fonction.

`LIVRAISON.#id_personnel` et `SESSION_FORMATION.#id_formateur` pointent tous deux
vers `PERSONNEL` tout entier : rien en base n'empêche d'affecter un cuisinier à
une tournée, ni un livreur à une session. La vérification est **une seule
méthode**, `PersonnelService.obtenir_avec_fonction`, et ce module la teste pour
elle-même.

Les deux appelants sont testés dans leurs modules respectifs — ce qui compte ici
est que la règle n'existe qu'à un endroit.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide
from app.models.personnel import FonctionPersonnel, Personnel
from app.services.personnel_service import PersonnelService
from tests.conftest import creer_engine_sqlite


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Personnel.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> PersonnelService:
    return PersonnelService(db)


def _salarie(db: Session, fonction: FonctionPersonnel) -> Personnel:
    personnel = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=fonction,
        email=f"{fonction.value.lower()}_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(personnel)
    db.commit()
    return personnel


def test_la_bonne_fonction_est_acceptee(db: Session, service: PersonnelService) -> None:
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)

    trouve = service.obtenir_avec_fonction(
        livreur.id_personnel, FonctionPersonnel.LIVREUR, pour="une livraison"
    )

    assert trouve.id_personnel == livreur.id_personnel


@pytest.mark.parametrize(
    "fonction",
    [
        FonctionPersonnel.CUISINIER,
        FonctionPersonnel.FORMATEUR,
        FonctionPersonnel.RECEPTIONNISTE,
        FonctionPersonnel.AUTRE,
    ],
)
def test_toute_autre_fonction_est_refusee(
    db: Session, service: PersonnelService, fonction: FonctionPersonnel
) -> None:
    """422 : l'identifiant vient du corps, pas de l'URL."""
    intrus = _salarie(db, fonction)

    with pytest.raises(ReferenceInvalide):
        service.obtenir_avec_fonction(
            intrus.id_personnel, FonctionPersonnel.LIVREUR, pour="une livraison"
        )


def test_le_message_nomme_la_fonction_constatee(
    db: Session, service: PersonnelService
) -> None:
    """Sans elle, l'administrateur doit aller lire la fiche du salarié."""
    cuisinier = _salarie(db, FonctionPersonnel.CUISINIER)

    with pytest.raises(ReferenceInvalide) as capture:
        service.obtenir_avec_fonction(
            cuisinier.id_personnel, FonctionPersonnel.LIVREUR, pour="une livraison"
        )

    assert "Cuisinier" in str(capture.value)


def test_le_message_nomme_l_affectation(db: Session, service: PersonnelService) -> None:
    """Le même salarié refusé pour deux raisons différentes doit le lire."""
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)

    with pytest.raises(ReferenceInvalide) as capture:
        service.obtenir_avec_fonction(
            livreur.id_personnel,
            FonctionPersonnel.FORMATEUR,
            pour="une session de formation",
        )

    assert "session de formation" in str(capture.value)


def test_un_salarie_archive_est_traite_comme_inexistant(
    db: Session, service: PersonnelService
) -> None:
    """Le message ne doit pas non plus confirmer qu'il a existé."""
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)
    livreur.supprime_le = datetime.now(UTC)
    db.commit()

    with pytest.raises(ReferenceInvalide) as capture:
        service.obtenir_avec_fonction(
            livreur.id_personnel, FonctionPersonnel.LIVREUR, pour="une livraison"
        )

    assert "Rakoto" not in str(capture.value)


def test_un_inconnu_est_refuse(service: PersonnelService) -> None:
    with pytest.raises(ReferenceInvalide):
        service.obtenir_avec_fonction(
            99999, FonctionPersonnel.LIVREUR, pour="une livraison"
        )


def test_les_deux_appelants_passent_par_cette_methode() -> None:
    """Verrou de conception : la règle ne doit exister qu'à un endroit.

    Si quelqu'un réintroduit une comparaison de `fonction` dans l'un des deux
    services, ce test tombe — même si le comportement reste correct sur le
    moment, c'est la divergence future qu'il empêche.
    """
    import inspect

    from app.services import livraison_service, session_formation_service

    for module in (livraison_service, session_formation_service):
        source = inspect.getsource(module)
        assert "obtenir_avec_fonction" in source
        assert "FonctionPersonnel." in source
        # Aucune comparaison directe : elle signalerait une seconde
        # implémentation en train de renaître.
        assert ".fonction is not" not in source
        assert ".fonction !=" not in source
