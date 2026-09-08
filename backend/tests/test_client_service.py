"""Tests de `ClientService` : anonymisation et restauration.

Le dernier test tourne contre PostgreSQL et **seulement** PostgreSQL : il a
besoin de la table `RESERVATION`, dont le `CHECK` d'exclusivité utilise la
syntaxe `(colonne IS NOT NULL)::int`. La créer sur SQLite supposerait de la
priver de cette contrainte, donc de ne plus vérifier le schéma de production.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthentificationInvalide, ConflitMetier
from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.models.client_particulier import ClientParticulier
from app.models.reservation import Reservation, TypeReservation
from app.models.salle import Salle
from app.schemas.auth import Connexion, InscriptionEntreprise, InscriptionParticulier
from app.schemas.client import ClientRead
from app.schemas.client_entreprise import ClientEntrepriseCreate
from app.schemas.client_particulier import ClientParticulierCreate
from app.services.auth_service import AuthService
from app.services.client_service import MENTION_ANONYME, ClientService
from tests.conftest import creer_engine_sqlite

MOT_DE_PASSE = "motdepasse123"
EMAIL = "jean@example.mg"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Client.__table__, ClientParticulier.__table__, ClientEntreprise.__table__
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> ClientService:
    return ClientService(db)


def _inscrire(db: Session, email: str = EMAIL) -> Client:
    return AuthService(db).inscrire_particulier(
        InscriptionParticulier(
            email=email,
            mot_de_passe=MOT_DE_PASSE,
            telephone="+261340000000",
            adresse="Lot II Antananarivo",
            identite=ClientParticulierCreate(nom="Rakoto", prenom="Jean"),
        )
    )


# --- Anonymisation -----------------------------------------------------------


def test_anonymisation_efface_les_donnees_personnelles(
    db: Session, service: ClientService
) -> None:
    client = _inscrire(db)

    service.anonymiser(client.id_client)

    assert client.email != EMAIL
    assert client.email.endswith("@delta.invalid")
    assert client.telephone is None
    assert client.adresse is None
    assert client.particulier.nom == MENTION_ANONYME
    assert client.particulier.prenom == MENTION_ANONYME


def test_anonymisation_conserve_identifiant_et_type(
    db: Session, service: ClientService
) -> None:
    """La ligne reste : c'est ce qui permet aux enregistrements liés de tenir."""
    client = _inscrire(db)
    identifiant = client.id_client

    service.anonymiser(identifiant)

    assert client.id_client == identifiant
    assert client.type_client == TypeClient.PARTICULIER


def test_anonymisation_archive_aussi_le_compte(
    db: Session, service: ClientService
) -> None:
    """Anonymisation et soft delete cohabitent, ils ne se remplacent pas."""
    client = _inscrire(db)

    service.anonymiser(client.id_client)

    assert client.supprime_le is not None
    assert service.clients.list() == []


def test_aucune_connexion_possible_apres_anonymisation(
    db: Session, service: ClientService
) -> None:
    """L'ancien e-mail ne rouvre plus le compte, quel que soit le mot de passe."""
    client = _inscrire(db)
    auth = AuthService(db)

    service.anonymiser(client.id_client)

    with pytest.raises(AuthentificationInvalide):
        auth.authentifier(Connexion(email=EMAIL, mot_de_passe=MOT_DE_PASSE))
    with pytest.raises(AuthentificationInvalide):
        auth.authentifier(Connexion(email=EMAIL, mot_de_passe="autre_mot_de_passe"))


def test_adresse_anonyme_non_soumissible_par_l_api(
    db: Session, service: ClientService
) -> None:
    """L'adresse générée ne peut même pas franchir la validation d'entrée.

    `delta.invalid` est un domaine réservé par la RFC 2606, qu'`EmailStr`
    refuse. Personne ne peut donc soumettre cette adresse — ni pour se
    connecter, ni pour s'inscrire en usurpant un compte anonymisé. C'est une
    propriété du choix de domaine, pas un effet de bord.
    """
    client = _inscrire(db)
    service.anonymiser(client.id_client)

    with pytest.raises(PydanticValidationError):
        Connexion(email=client.email, mot_de_passe=MOT_DE_PASSE)


def test_client_anonymise_reste_serialisable(
    db: Session, service: ClientService
) -> None:
    """Corollaire : le schema de lecture doit accepter l'adresse anonyme.

    Sans quoi toute lecture d'un compte anonymisé échouerait en 500 — ce qui
    était le cas tant que `ClientRead.email` était typé `EmailStr`.
    """
    client = _inscrire(db)
    service.anonymiser(client.id_client)

    lu = ClientRead.model_validate(client)

    assert lu.email == client.email
    assert lu.particulier is not None
    assert lu.particulier.nom == MENTION_ANONYME


def test_email_libere_apres_anonymisation(db: Session, service: ClientService) -> None:
    """L'adresse redevient disponible : c'est l'objet de l'index partiel."""
    premier = _inscrire(db)
    service.anonymiser(premier.id_client)

    second = _inscrire(db)

    assert second.id_client != premier.id_client
    assert second.email == EMAIL


def test_anonymisation_dune_entreprise(db: Session, service: ClientService) -> None:
    client = Client(
        type_client=TypeClient.ENTREPRISE,
        email="contact@societe.mg",
        mot_de_passe=hacher_mot_de_passe(MOT_DE_PASSE),
    )
    client.entreprise = ClientEntreprise(
        raison_sociale="Société Anonyme",
        numero_id_fiscal="1234567890",
        nom_contact_referent="Rasoa Marie",
    )
    db.add(client)
    db.commit()

    service.anonymiser(client.id_client)

    assert client.entreprise.raison_sociale == MENTION_ANONYME
    assert client.entreprise.nom_contact_referent is None


# --- Restauration ------------------------------------------------------------


def test_restauration_reactive_le_compte(db: Session, service: ClientService) -> None:
    client = _inscrire(db)
    service.clients.delete(client)
    db.commit()

    service.restaurer(client.id_client)

    assert client.supprime_le is None
    assert service.clients.get_by_email(EMAIL) is not None


def test_restauration_est_idempotente(db: Session, service: ClientService) -> None:
    """Rejouer une restauration sur un compte actif n'est pas une erreur."""
    client = _inscrire(db)

    assert service.restaurer(client.id_client).supprime_le is None


def test_restauration_refusee_si_email_reattribue(
    db: Session, service: ClientService
) -> None:
    """Le cas que l'index partiel rend possible, et qui doit être traduit.

    L'e-mail libéré par l'archivage a été repris par un nouveau compte actif :
    restaurer l'ancien créerait deux comptes actifs de même adresse. La base le
    refuse, et le service doit en faire un message métier — pas une trace SQL.
    """
    ancien = _inscrire(db)
    service.clients.delete(ancien)
    db.commit()
    _inscrire(db)  # reprend la même adresse

    with pytest.raises(ConflitMetier) as capture:
        service.restaurer(ancien.id_client)

    message = str(capture.value)
    assert "restauration impossible" in message
    assert "UNIQUE" not in message and "uq_client_email" not in message


def test_restauration_ne_ressuscite_pas_les_donnees_anonymisees(
    db: Session, service: ClientService
) -> None:
    """L'anonymisation est irréversible : restaurer rend visible, pas lisible."""
    client = _inscrire(db)
    service.anonymiser(client.id_client)

    service.restaurer(client.id_client)

    assert client.supprime_le is None
    assert client.particulier.nom == MENTION_ANONYME
    assert client.email != EMAIL


# --- Contre PostgreSQL uniquement --------------------------------------------


@pytest.mark.postgres
def test_reservation_reste_lisible_apres_anonymisation(
    session_postgres: Session,
) -> None:
    """Une réservation garde son lien vers le client devenu anonyme.

    C'est la contrepartie de l'anonymisation : la preuve de transaction survit,
    rattachée à une identité effacée. Ce test exige PostgreSQL — la table
    RESERVATION porte un CHECK en syntaxe PostgreSQL.
    """
    db = session_postgres
    client = AuthService(db).inscrire_particulier(
        InscriptionParticulier(
            email=f"anon_{datetime.now(UTC).timestamp()}@example.mg",
            mot_de_passe=MOT_DE_PASSE,
            identite=ClientParticulierCreate(nom="Rakoto", prenom="Jean"),
        )
    )
    # `tarif_horaire` est obligatoire depuis #45 : une salle porte toujours
    # au moins un tarif. La valeur importe peu ici, ce test porte sur
    # l'anonymisation.
    salle = Salle(nom="Salle sonde", capacite=10, tarif_horaire=Decimal("1.00"))
    db.add(salle)
    db.flush()
    reservation = Reservation(
        type_reservation=TypeReservation.SALLE,
        date_debut=datetime.now(UTC),
        date_fin=datetime.now(UTC),
        statut="Confirmee",
        id_client=client.id_client,
        id_salle=salle.id_salle,
    )
    db.add(reservation)
    db.commit()
    identifiant_reservation = reservation.id_reservation

    ClientService(db).anonymiser(client.id_client)

    db.expire_all()
    relue = db.get(Reservation, identifiant_reservation)
    assert relue is not None, "la réservation a disparu"
    assert relue.id_client == client.id_client, "le lien vers le client est rompu"
    assert relue.statut == "Confirmee"
    assert relue.client.email.endswith("@delta.invalid"), "client non anonymisé"


# --- Propagation aux lignes filles -------------------------------------------


def test_anonymisation_archive_aussi_la_ligne_fille_particulier(
    db: Session, service: ClientService
) -> None:
    """Un archivage est un UPDATE : le CASCADE du sous-type ne se déclenche pas.

    Sans propagation explicite, la ligne fille restait active sous un parent
    archivé — état incohérent, et surtout bloquant : sa valeur unique restait
    prise par l'index partiel.
    """
    client = _inscrire(db)

    service.anonymiser(client.id_client)

    assert client.supprime_le is not None
    assert client.particulier.supprime_le is not None


def test_numero_fiscal_libere_apres_anonymisation(
    db: Session, service: ClientService
) -> None:
    """Une société anonymisée doit pouvoir se réinscrire avec son numéro fiscal.

    Il désigne une personne morale de façon permanente : le lui interdire à vie
    reviendrait à la radier, pas à effacer ses données personnelles.
    """
    auth = AuthService(db)
    premiere = auth.inscrire_entreprise(
        InscriptionEntreprise(
            email="contact@societe.mg",
            mot_de_passe=MOT_DE_PASSE,
            identite=ClientEntrepriseCreate(
                raison_sociale="Société Delta", numero_id_fiscal="1234567890"
            ),
        )
    )

    service.anonymiser(premiere.id_client)

    seconde = auth.inscrire_entreprise(
        InscriptionEntreprise(
            email="nouveau@societe.mg",
            mot_de_passe=MOT_DE_PASSE,
            identite=ClientEntrepriseCreate(
                raison_sociale="Société Delta", numero_id_fiscal="1234567890"
            ),
        )
    )

    assert seconde.id_client != premiere.id_client


def test_restauration_reactive_aussi_la_ligne_fille_particulier(
    db: Session, service: ClientService
) -> None:
    """La restauration doit défaire exactement ce que l'archivage a fait."""
    client = _inscrire(db)
    service.anonymiser(client.id_client)

    service.restaurer(client.id_client)

    assert client.supprime_le is None
    assert client.particulier.supprime_le is None


def test_restauration_dun_particulier_refusee_apres_propagation(
    db: Session, service: ClientService
) -> None:
    """Collision d'e-mail sur un compte dont la ligne fille est archivée aussi.

    Complète `test_restauration_refusee_si_email_reattribue`, qui archive par un
    `clients.delete()` direct : la ligne fille y reste active, donc le chemin de
    propagation n'est jamais exercé sous collision. Ici le compte est archivé par
    `anonymiser()`, donc les deux lignes le sont, et la restauration doit
    échouer **proprement** — sans laisser la ligne fille réactivée alors que le
    parent ne l'est pas.
    """
    ancien = _inscrire(db)
    service.anonymiser(ancien.id_client)
    assert ancien.particulier.supprime_le is not None, "propagation attendue"

    # L'adresse d'origine est libre : c'est l'objet de l'index partiel.
    _inscrire(db)

    # `anonymiser` a réécrit l'e-mail de l'ancien compte ; on le remet à sa
    # valeur d'origine pour provoquer exactement la collision visée.
    ancien.email = EMAIL
    db.flush()

    with pytest.raises(ConflitMetier) as capture:
        service.restaurer(ancien.id_client)

    assert "restauration impossible" in str(capture.value)
    # La cause prouve que le refus vient bien de la base, et non d'un
    # pré-contrôle applicatif qui produirait le même message.
    assert isinstance(capture.value.__cause__, IntegrityError)
    db.refresh(ancien)
    db.refresh(ancien.particulier)
    assert ancien.supprime_le is not None, "le parent doit rester archivé"
    assert (
        ancien.particulier.supprime_le is not None
    ), "la ligne fille ne doit pas rester réactivée après un rollback"
