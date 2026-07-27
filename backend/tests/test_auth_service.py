"""Tests du service d'authentification.

Base SQLite en mémoire, limitée aux deux tables du parcours. Le mapping 1-1
`client` / `client_particulier` et la contrainte `UNIQUE` sur l'e-mail y sont
reproduits fidèlement, ce qui suffit à exercer les règles de gestion sans
serveur PostgreSQL.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import Base
from app.core.exceptions import AuthentificationInvalide
from app.core.security import decoder_jeton_acces, hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.schemas.auth import Connexion, InscriptionParticulier
from app.schemas.client_particulier import ClientParticulierCreate
from app.services.auth_service import AuthService, EmailDejaUtilise

MOT_DE_PASSE = "motdepasse123"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine, tables=[Client.__table__, ClientParticulier.__table__]
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> AuthService:
    return AuthService(db)


def _inscription(email: str = "jean@example.mg") -> InscriptionParticulier:
    return InscriptionParticulier(
        email=email,
        mot_de_passe=MOT_DE_PASSE,
        telephone="+261340000000",
        identite=ClientParticulierCreate(nom="Rakoto", prenom="Jean"),
    )


def test_inscription_cree_les_deux_lignes(service: AuthService, db: Session) -> None:
    """CLIENT et CLIENT_PARTICULIER sont écrits dans la même transaction."""
    client = service.inscrire_particulier(_inscription())

    assert client.id_client is not None
    assert client.type_client == TypeClient.PARTICULIER
    assert client.particulier is not None
    assert client.particulier.nom == "Rakoto"
    assert db.get(ClientParticulier, client.id_client) is not None


def test_inscription_ne_stocke_pas_le_mot_de_passe_en_clair(
    service: AuthService,
) -> None:
    client = service.inscrire_particulier(_inscription())

    assert client.mot_de_passe != MOT_DE_PASSE
    assert client.mot_de_passe.startswith("$2b$")


def test_inscription_refuse_un_email_deja_pris(service: AuthService) -> None:
    """Cas courant : le pré-contrôle applicatif suffit."""
    service.inscrire_particulier(_inscription())

    with pytest.raises(EmailDejaUtilise):
        service.inscrire_particulier(_inscription())


def test_inscription_refuse_un_email_deja_pris_malgre_le_precontrole(
    service: AuthService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cas de course : le pré-contrôle est aveuglé, la base doit trancher.

    On simule deux inscriptions simultanées en neutralisant `get_by_email` :
    le service croit l'e-mail libre et va jusqu'au `commit`, où
    `uq_client_email` lève une `IntegrityError`. Le test échoue si cette erreur
    remonte brute au lieu d'être traduite en erreur métier.
    """
    service.inscrire_particulier(_inscription())
    monkeypatch.setattr(service.clients, "get_by_email", lambda email: None)

    with pytest.raises(EmailDejaUtilise):
        service.inscrire_particulier(_inscription())


def test_inscription_laisse_la_session_utilisable_apres_conflit(
    service: AuthService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Le rollback doit permettre d'enchaîner sur une inscription valide."""
    service.inscrire_particulier(_inscription())
    monkeypatch.setattr(service.clients, "get_by_email", lambda email: None)
    with pytest.raises(EmailDejaUtilise):
        service.inscrire_particulier(_inscription())

    monkeypatch.undo()
    autre = service.inscrire_particulier(_inscription("autre@example.mg"))

    assert autre.id_client is not None


def test_authentification_reussie(service: AuthService) -> None:
    inscrit = service.inscrire_particulier(_inscription())

    client = service.authentifier(
        Connexion(email="jean@example.mg", mot_de_passe=MOT_DE_PASSE)
    )

    assert client.id_client == inscrit.id_client


def test_authentification_mauvais_mot_de_passe(service: AuthService) -> None:
    service.inscrire_particulier(_inscription())

    with pytest.raises(AuthentificationInvalide):
        service.authentifier(
            Connexion(email="jean@example.mg", mot_de_passe="mauvais_mot_de_passe")
        )


def test_authentification_email_inconnu(service: AuthService) -> None:
    """Même exception que pour un mot de passe faux : pas d'énumération."""
    with pytest.raises(AuthentificationInvalide):
        service.authentifier(
            Connexion(email="inconnu@example.mg", mot_de_passe=MOT_DE_PASSE)
        )


def test_jeton_emis_identifie_le_client(service: AuthService) -> None:
    """Le `sub` du JWT porte l'identifiant du client, sous forme de chaîne."""
    from app.core.security import creer_jeton_acces

    client = service.inscrire_particulier(_inscription())

    charge_utile = decoder_jeton_acces(creer_jeton_acces(client.id_client))

    assert charge_utile is not None
    assert charge_utile["sub"] == str(client.id_client)


def test_jeton_falsifie_est_rejete() -> None:
    assert decoder_jeton_acces("pas.un.jeton") is None


def test_hachage_produit_un_sel_different_a_chaque_appel() -> None:
    """Deux comptes de même mot de passe n'ont pas le même hash en base."""
    assert hacher_mot_de_passe(MOT_DE_PASSE) != hacher_mot_de_passe(MOT_DE_PASSE)
