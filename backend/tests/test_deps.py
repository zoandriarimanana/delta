"""Tests de `get_current_client`, socle des endpoints protégés.

La dépendance est appelée directement plutôt que par une requête HTTP : aucun
endpoint protégé n'existe encore, et monter une application factice ne
prouverait rien de plus sur sa logique. La traduction en 401 est déjà couverte
par `test_main.py`, qui vérifie le gestionnaire global d'`AuthentificationInvalide`.
"""

from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.core.database import Base
from app.core.deps import get_current_client
from app.core.exceptions import AuthentificationInvalide
from app.core.security import creer_jeton_acces, hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.repositories.client_repository import ClientRepository


@pytest.fixture
def db() -> Iterator[Session]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[Client.__table__])
    with Session(engine) as session:
        yield session


@pytest.fixture
def client_inscrit(db: Session) -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email="jean@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.commit()
    return client


def _entete(jeton: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=jeton)


def test_retourne_le_client_du_jeton(db: Session, client_inscrit: Client) -> None:
    jeton = creer_jeton_acces(client_inscrit.id_client)

    obtenu = get_current_client(_entete(jeton), db)

    assert obtenu.id_client == client_inscrit.id_client
    assert obtenu.email == "jean@example.mg"


def test_refuse_sans_en_tete(db: Session) -> None:
    """En-tête absent : 401, et surtout pas le 403 que HTTPBearer lèverait seul."""
    with pytest.raises(AuthentificationInvalide):
        get_current_client(None, db)


def test_refuse_un_jeton_illisible(db: Session) -> None:
    with pytest.raises(AuthentificationInvalide):
        get_current_client(_entete("pas.un.jeton"), db)


def test_refuse_un_jeton_expire(db: Session, client_inscrit: Client) -> None:
    jeton = creer_jeton_acces(client_inscrit.id_client, duree=timedelta(seconds=-1))

    with pytest.raises(AuthentificationInvalide):
        get_current_client(_entete(jeton), db)


def test_refuse_un_jeton_signe_avec_une_autre_cle(
    db: Session, client_inscrit: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un jeton forgé ailleurs ne doit pas ouvrir de session."""
    from app.core import security

    monkeypatch.setattr(security.settings, "SECRET_KEY", "une_autre_cle_secrete")
    jeton_etranger = creer_jeton_acces(client_inscrit.id_client)
    monkeypatch.undo()

    with pytest.raises(AuthentificationInvalide):
        get_current_client(_entete(jeton_etranger), db)


def test_refuse_un_compte_supprime(db: Session, client_inscrit: Client) -> None:
    """Le jeton reste cryptographiquement valide après suppression du compte.

    Sans ce contrôle, un jeton émis avant la suppression continuerait d'ouvrir
    l'accès jusqu'à son expiration, en désignant un client qui n'existe plus.
    """
    jeton = creer_jeton_acces(client_inscrit.id_client)

    # Suppression en SQL direct plutôt que `db.delete()` : la suppression ORM
    # déroulerait les cascades de CLIENT (sous-types, commandes) et exigerait la
    # présence de leurs tables, sans rien apporter à ce que ce test vérifie.
    db.execute(delete(Client).where(Client.id_client == client_inscrit.id_client))
    db.commit()
    # `Session.get` sert l'identity map avant d'interroger la base : sans ce
    # détachement, le repository retournerait l'objet encore en mémoire et le
    # test passerait pour une mauvaise raison.
    db.expunge_all()

    with pytest.raises(AuthentificationInvalide):
        get_current_client(_entete(jeton), db)


def _espionner_get_by_id(
    monkeypatch: pytest.MonkeyPatch,
) -> list[tuple[object, object]]:
    """Enregistre les appels à `ClientRepository.get_by_id` et leur résultat."""
    appels: list[tuple[object, object]] = []
    original = ClientRepository.get_by_id

    def espion(self: ClientRepository, identifiant: object) -> object:
        resultat = original(self, identifiant)
        appels.append((identifiant, resultat))
        return resultat

    monkeypatch.setattr(ClientRepository, "get_by_id", espion)
    return appels


def test_refuse_un_identifiant_jamais_attribue(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`sub` numériquement valide mais ne désignant aucun client.

    Distinct du compte supprimé : ici aucun client n'a jamais porté cet
    identifiant. Le test vérifie que la requête atteint bien le repository et
    que c'est son `None` qui provoque le refus — un rejet plus haut dans la
    fonction produirait le même message par coïncidence, et masquerait une
    éventuelle divergence de traitement.
    """
    appels = _espionner_get_by_id(monkeypatch)
    jeton = creer_jeton_acces(99999)

    with pytest.raises(AuthentificationInvalide):
        get_current_client(_entete(jeton), db)

    assert appels == [(99999, None)]


def test_identifiant_inconnu_et_compte_supprime_partagent_le_chemin(
    db: Session, client_inscrit: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Les deux cas doivent converger sur le même `get_by_id` retournant None.

    C'est ce qui garantit qu'ils sont indistinguables pour l'appelant : même
    branche, même message, et non deux chemins séparés dont les messages
    coïncideraient aujourd'hui et divergeraient au prochain refactor.
    """
    identifiant_reel = client_inscrit.id_client
    jeton_supprime = creer_jeton_acces(identifiant_reel)
    jeton_inconnu = creer_jeton_acces(99999)

    db.execute(delete(Client).where(Client.id_client == identifiant_reel))
    db.commit()
    db.expunge_all()

    appels = _espionner_get_by_id(monkeypatch)
    messages = set()
    for jeton in (jeton_supprime, jeton_inconnu):
        with pytest.raises(AuthentificationInvalide) as capture:
            get_current_client(_entete(jeton), db)
        messages.add(str(capture.value))

    assert appels == [(identifiant_reel, None), (99999, None)]
    assert len(messages) == 1


def test_refuse_un_sujet_non_numerique(db: Session) -> None:
    """`sub` doit être convertible en clé primaire entière."""
    jeton = creer_jeton_acces("pas-un-identifiant")

    with pytest.raises(AuthentificationInvalide):
        get_current_client(_entete(jeton), db)


def test_message_de_refus_identique_dans_tous_les_cas(
    db: Session, client_inscrit: Client
) -> None:
    """Aucun cas de rejet ne doit être distinguable d'un autre.

    Distinguer « jeton expiré » de « compte supprimé » renseignerait un
    attaquant sans rien apporter à l'utilisateur légitime.
    """
    expire = creer_jeton_acces(client_inscrit.id_client, duree=timedelta(seconds=-1))
    messages = set()

    for cas in (None, _entete("illisible"), _entete(expire)):
        with pytest.raises(AuthentificationInvalide) as capture:
            get_current_client(cas, db)
        messages.add(str(capture.value))

    assert len(messages) == 1
