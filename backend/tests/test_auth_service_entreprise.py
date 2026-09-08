"""Tests de l'inscription CLIENT_ENTREPRISE.

Fichier distinct de `test_auth_service.py` : même service, mais un parcours et
des règles d'unicité qui lui sont propres. Les fondre rendrait illisible ce qui
relève du particulier et ce qui relève de l'entreprise.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from app.core.integrite import viole_contrainte
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.models.client_particulier import ClientParticulier
from app.schemas.auth import (
    Connexion,
    InscriptionEntreprise,
    InscriptionParticulier,
)
from app.schemas.client_entreprise import ClientEntrepriseCreate
from app.schemas.client_particulier import ClientParticulierCreate
from app.services.auth_service import (
    CONTRAINTE_EMAIL_UNIQUE,
    CONTRAINTE_FISCAL_UNIQUE,
    AuthService,
    EmailDejaUtilise,
    NumeroFiscalDejaUtilise,
)
from tests.conftest import creer_engine_sqlite, erreur_integrite_postgres

MOT_DE_PASSE = "motdepasse123"
EMAIL = "contact@societe.mg"
FISCAL = "1234567890"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Client.__table__, ClientParticulier.__table__, ClientEntreprise.__table__
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> AuthService:
    return AuthService(db)


def _entreprise(email: str = EMAIL, fiscal: str = FISCAL) -> InscriptionEntreprise:
    return InscriptionEntreprise(
        email=email,
        mot_de_passe=MOT_DE_PASSE,
        telephone="+261340000000",
        identite=ClientEntrepriseCreate(
            raison_sociale="Société Delta",
            numero_id_fiscal=fiscal,
            secteur_activite="Restauration",
            nom_contact_referent="Rasoa Marie",
        ),
    )


def _particulier(email: str) -> InscriptionParticulier:
    return InscriptionParticulier(
        email=email,
        mot_de_passe=MOT_DE_PASSE,
        identite=ClientParticulierCreate(nom="Rakoto", prenom="Jean"),
    )


# --- Inscription -------------------------------------------------------------


def test_inscription_cree_les_deux_lignes(service: AuthService, db: Session) -> None:
    """CLIENT et CLIENT_ENTREPRISE écrits dans la même transaction."""
    client = service.inscrire_entreprise(_entreprise())

    assert client.id_client is not None
    assert client.type_client == TypeClient.ENTREPRISE
    assert client.entreprise is not None
    assert client.entreprise.raison_sociale == "Société Delta"
    assert db.get(ClientEntreprise, client.id_client) is not None


def test_champs_optionnels_absents(service: AuthService) -> None:
    """Seuls `raison_sociale` et `numero_id_fiscal` sont obligatoires."""
    client = service.inscrire_entreprise(
        InscriptionEntreprise(
            email="minimal@societe.mg",
            mot_de_passe=MOT_DE_PASSE,
            identite=ClientEntrepriseCreate(
                raison_sociale="Minimale", numero_id_fiscal="999"
            ),
        )
    )

    assert client.entreprise.secteur_activite is None
    assert client.entreprise.nom_contact_referent is None


def test_mot_de_passe_hache(service: AuthService) -> None:
    client = service.inscrire_entreprise(_entreprise())

    assert client.mot_de_passe != MOT_DE_PASSE
    assert client.mot_de_passe.startswith("$2b$")


# --- Unicité de l'e-mail -----------------------------------------------------


def test_email_deja_pris_par_une_entreprise(service: AuthService) -> None:
    service.inscrire_entreprise(_entreprise())

    with pytest.raises(EmailDejaUtilise):
        service.inscrire_entreprise(_entreprise(fiscal="autre_numero"))


def test_email_deja_pris_par_un_particulier(service: AuthService) -> None:
    """La règle d'identité du MLD : un e-mail = une seule identité CLIENT."""
    service.inscrire_particulier(_particulier(EMAIL))

    with pytest.raises(EmailDejaUtilise):
        service.inscrire_entreprise(_entreprise())


def test_le_message_ne_divulgue_pas_le_type_de_compte(service: AuthService) -> None:
    """Le message doit être le même quel que soit le sous-type déjà inscrit.

    Répondre « vous avez déjà un compte particulier » renseignerait qui saisit
    une adresse au hasard sur l'existence et la nature d'un compte.
    """
    service.inscrire_particulier(_particulier("a@societe.mg"))
    service.inscrire_entreprise(_entreprise(email="b@societe.mg"))

    messages = set()
    for email in ("a@societe.mg", "b@societe.mg"):
        with pytest.raises(EmailDejaUtilise) as capture:
            service.inscrire_entreprise(_entreprise(email=email, fiscal="autre"))
        messages.add(str(capture.value))

    assert len(messages) == 1
    assert "particulier" not in messages.pop().lower()


# --- Unicité du numéro fiscal ------------------------------------------------


def test_numero_fiscal_deja_pris(service: AuthService) -> None:
    service.inscrire_entreprise(_entreprise())

    with pytest.raises(NumeroFiscalDejaUtilise):
        service.inscrire_entreprise(_entreprise(email="autre@societe.mg"))


def test_les_deux_conflits_ont_des_messages_distincts(service: AuthService) -> None:
    """Confondre les deux afficherait « e-mail » à qui a saisi un doublon fiscal."""
    service.inscrire_entreprise(_entreprise())

    with pytest.raises(EmailDejaUtilise) as conflit_email:
        service.inscrire_entreprise(_entreprise(fiscal="autre_numero"))
    with pytest.raises(NumeroFiscalDejaUtilise) as conflit_fiscal:
        service.inscrire_entreprise(_entreprise(email="autre@societe.mg"))

    assert str(conflit_email.value) != str(conflit_fiscal.value)
    assert "fiscale" in str(conflit_fiscal.value)


# --- Courses : la base tranche ------------------------------------------------


def test_conflit_email_malgre_le_precontrole(
    service: AuthService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Deux inscriptions simultanées : seule la contrainte en base tranche."""
    service.inscrire_entreprise(_entreprise())
    monkeypatch.setattr(service.clients, "get_by_email", lambda email: None)

    with pytest.raises(EmailDejaUtilise):
        service.inscrire_entreprise(_entreprise(fiscal="autre_numero"))


def test_conflit_fiscal_malgre_le_precontrole(
    service: AuthService, monkeypatch: pytest.MonkeyPatch
) -> None:
    service.inscrire_entreprise(_entreprise())
    monkeypatch.setattr(
        service.entreprises, "get_by_numero_id_fiscal", lambda numero: None
    )

    with pytest.raises(NumeroFiscalDejaUtilise):
        service.inscrire_entreprise(_entreprise(email="autre@societe.mg"))


def test_les_discriminants_ne_se_confondent_pas() -> None:
    """Chaque helper ne reconnaît que sa propre contrainte."""
    from app.services.auth_service import _est_conflit_email, _est_conflit_fiscal

    erreur_email = erreur_integrite_postgres(CONTRAINTE_EMAIL_UNIQUE)
    erreur_fiscal = erreur_integrite_postgres(CONTRAINTE_FISCAL_UNIQUE)

    assert _est_conflit_email(erreur_email)
    assert not _est_conflit_email(erreur_fiscal)
    assert _est_conflit_fiscal(erreur_fiscal)
    assert not _est_conflit_fiscal(erreur_email)
    assert viole_contrainte(erreur_fiscal, CONTRAINTE_FISCAL_UNIQUE)


# --- Connexion : commune aux deux sous-types ----------------------------------


def test_connexion_fonctionne_pour_une_entreprise(service: AuthService) -> None:
    """`authentifier()` n'a pas été dupliqué : elle porte sur CLIENT."""
    inscrit = service.inscrire_entreprise(_entreprise())

    client = service.authentifier(Connexion(email=EMAIL, mot_de_passe=MOT_DE_PASSE))

    assert client.id_client == inscrit.id_client
    assert client.type_client == TypeClient.ENTREPRISE


def test_connexion_refusee_avec_mauvais_mot_de_passe(service: AuthService) -> None:
    from app.core.exceptions import AuthentificationInvalide

    service.inscrire_entreprise(_entreprise())

    with pytest.raises(AuthentificationInvalide):
        service.authentifier(Connexion(email=EMAIL, mot_de_passe="mauvais"))


# --- Composition avec le soft delete ------------------------------------------


def test_email_libere_apres_archivage(service: AuthService, db: Session) -> None:
    """`get_by_email` filtrant les actifs, l'adresse redevient disponible.

    Sans ce filtre, `one_or_none()` lèverait `MultipleResultsFound` — l'index
    étant partiel, deux lignes peuvent porter le même e-mail.
    """
    premier = service.inscrire_entreprise(_entreprise())
    service.clients.delete(premier)
    db.commit()

    second = service.inscrire_entreprise(_entreprise(fiscal="autre_numero"))

    assert second.id_client != premier.id_client
    assert second.email == EMAIL


def test_numero_fiscal_libere_apres_archivage(
    service: AuthService, db: Session
) -> None:
    """Le symétrique, et le vrai risque de cette issue.

    Un numéro fiscal désigne une personne morale de façon permanente : une
    société dont le compte est archivé doit pouvoir se réinscrire avec le sien.
    Sans le filtre de `get_by_numero_id_fiscal`, la méthode lèverait
    `MultipleResultsFound` au lieu de laisser l'inscription aboutir.
    """
    premier = service.inscrire_entreprise(_entreprise())
    service.clients.delete(premier)
    service.entreprises.delete(premier.entreprise)
    db.commit()

    second = service.inscrire_entreprise(_entreprise(email="autre@societe.mg"))

    assert second.entreprise.numero_id_fiscal == FISCAL
    assert second.id_client != premier.id_client


def test_archivage_dun_compte_actif_ne_libere_pas_pour_autant(
    service: AuthService,
) -> None:
    """Garde-fou : la partialité ne relâche rien entre lignes actives."""
    service.inscrire_entreprise(_entreprise())

    with pytest.raises(NumeroFiscalDejaUtilise):
        service.inscrire_entreprise(_entreprise(email="autre@societe.mg"))
