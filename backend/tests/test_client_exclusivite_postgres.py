"""Trigger d'exclusivité CLIENT, contre PostgreSQL uniquement.

Le trigger `verifier_exclusivite_client()` (migration `4cfa278b3371`,
dette technique T0.7) n'existe que sur PostgreSQL : c'est une fonction
PL/pgSQL et un `CREATE CONSTRAINT TRIGGER`, qu'aucune base SQLite ne sait
créer ni exécuter.

**Piège à connaître avant de lire ces tests** : `session_postgres`
(`tests/conftest.py`) exécute chaque test dans une transaction externe
annulée à la sortie, et `join_transaction_mode="create_savepoint"` fait de
chaque `db.commit()` un simple relâchement de `SAVEPOINT` — jamais un vrai
`COMMIT`. Or un trigger `DEFERRABLE INITIALLY DEFERRED` ne se déclenche qu'au
véritable commit de la transaction PostgreSQL, pas à la libération d'un
savepoint. Sans le savoir, tous les scénarios ci-dessous passeraient au vert
sans jamais avoir réellement vérifié le trigger.

La parade, pour tout scénario qui ne teste pas la concurrence :
`SET CONSTRAINTS ALL IMMEDIATE` force PostgreSQL à évaluer immédiatement les
contraintes différées en attente, **sans** nécessiter de vrai commit — vérifié
empiriquement en construisant ce fichier (le rejet survient bien, et la
transaction externe continue de tout annuler au `rollback()` de fin de test,
donc aucun nettoyage manuel n'est nécessaire pour ces tests-là).

**Exception : `test_...concurrence...` plus bas.** Prouver qu'une race
condition est fermée exige deux **vraies** transactions, sur deux connexions
séparées, qui commitent réellement — ce que `session_postgres` ne peut
structurellement pas fournir (une seule session, un seul outer-transaction
jamais commité). Ce test ouvre donc ses propres connexions directement sur
`app.core.database.engine`, et nettoie explicitement ce qu'il insère : c'est
le seul test de ce fichier qui écrit réellement en base.
"""

import threading

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import engine as engine_application
from app.schemas.auth import InscriptionEntreprise, InscriptionParticulier
from app.schemas.client_entreprise import ClientEntrepriseCreate
from app.schemas.client_particulier import ClientParticulierCreate
from app.services.auth_service import AuthService

pytestmark = pytest.mark.postgres

MOT_DE_PASSE = "motdepasse123"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


def _inserer_client(db: Session, id_client: int) -> None:
    db.execute(
        text(
            "INSERT INTO client (id_client, type_client, email, mot_de_passe) "
            "VALUES (:id, 'Particulier', :email, 'x')"
        ),
        {"id": id_client, "email": f"exclusivite{id_client}@delta.mg"},
    )


def _inserer_particulier(db: Session, id_client: int) -> None:
    db.execute(
        text(
            "INSERT INTO client_particulier (id_client, nom, prenom) "
            "VALUES (:id, 'Rakoto', 'Jean')"
        ),
        {"id": id_client},
    )


def _inserer_entreprise(db: Session, id_client: int) -> None:
    db.execute(
        text(
            "INSERT INTO client_entreprise"
            " (id_client, raison_sociale, numero_id_fiscal)"
            " VALUES (:id, 'Delta SARL', :fiscal)"
        ),
        {"id": id_client, "fiscal": f"FISC-{id_client}"},
    )


def _forcer_verification(db: Session) -> None:
    """Déclenche les triggers différés en attente, sans vrai commit.

    Voir la docstring du module : c'est ce qui rend ces tests possibles sous
    `session_postgres`, dont les `commit()` ne sont que des `SAVEPOINT`.
    """
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))


def test_une_seule_ligne_particulier_est_acceptee(db: Session) -> None:
    _inserer_client(db, 101)
    _inserer_particulier(db, 101)
    db.commit()

    _forcer_verification(db)  # ne doit rien lever


def test_une_seule_ligne_entreprise_est_acceptee(db: Session) -> None:
    _inserer_client(db, 102)
    _inserer_entreprise(db, 102)
    db.commit()

    _forcer_verification(db)  # ne doit rien lever


def test_aucune_ligne_fille_est_refusee(db: Session) -> None:
    """Le cas « jamais aucune » — celui qu'un simple trigger immédiat sur les
    tables filles seules ne peut structurellement pas couvrir."""
    _inserer_client(db, 103)
    db.commit()

    with pytest.raises(IntegrityError, match="exactement une ligne fille"):
        _forcer_verification(db)


def test_les_deux_lignes_filles_sont_refusees(db: Session) -> None:
    _inserer_client(db, 104)
    _inserer_particulier(db, 104)
    _inserer_entreprise(db, 104)
    db.commit()

    with pytest.raises(IntegrityError, match="exactement une ligne fille"):
        _forcer_verification(db)


def test_ajout_d_une_seconde_ligne_apres_coup_est_refuse(db: Session) -> None:
    """Un client déjà pourvu d'une ligne fille (vérifiée, acceptée) qui en
    reçoit une seconde plus tard doit être refusé — pas seulement « les deux
    dans la même écriture ».

    `SET CONSTRAINTS ALL IMMEDIATE` n'est pas un « vérifie une fois » : c'est
    un changement de mode pour le **reste de la transaction** (constaté en
    construisant ce test). Une fois appelé, le second `INSERT` déclenche donc
    son trigger immédiatement, à l'instruction elle-même — pas besoin d'un
    second appel explicite pour l'observer.
    """
    _inserer_client(db, 105)
    _inserer_particulier(db, 105)
    db.commit()
    _forcer_verification(db)  # la première ligne, seule, est acceptée ici

    with pytest.raises(IntegrityError, match="exactement une ligne fille"):
        _inserer_entreprise(db, 105)


def test_inscription_particulier_n_interfere_pas_avec_le_trigger(db: Session) -> None:
    """Le chemin normal de l'API ne doit jamais heurter ce filet."""
    service = AuthService(db)
    donnees = InscriptionParticulier(
        email="postgres-particulier@delta.mg",
        mot_de_passe=MOT_DE_PASSE,
        telephone="+261340000000",
        identite=ClientParticulierCreate(nom="Rakoto", prenom="Jean"),
    )

    service.inscrire_particulier(donnees)

    _forcer_verification(db)  # ne doit rien lever


def test_inscription_entreprise_n_interfere_pas_avec_le_trigger(db: Session) -> None:
    service = AuthService(db)
    donnees = InscriptionEntreprise(
        email="postgres-entreprise@delta.mg",
        mot_de_passe=MOT_DE_PASSE,
        telephone="+261340000000",
        identite=ClientEntrepriseCreate(
            raison_sociale="Delta SARL", numero_id_fiscal="FISC-POSTGRES-1"
        ),
    )

    service.inscrire_entreprise(donnees)

    _forcer_verification(db)  # ne doit rien lever


# --- Concurrence : deux vraies transactions, deux vraies connexions --------


def test_deux_ecritures_concurrentes_sur_un_client_orphelin_n_en_laissent_qu_une() -> (
    None
):
    """La race qui a motivé `pg_advisory_xact_lock` dans le trigger.

    Reproduite empiriquement en construisant cette migration, sur un client
    déjà orphelin (créé ici en désactivant le trigger le temps de l'insertion,
    pour simuler une donnée déjà là avant que ce trigger n'existe — le seul
    scénario réaliste où un tel orphelin peut exister une fois ce trigger en
    place) : deux transactions séparées, chacune ajoutant une ligne fille
    différente, synchronisées pour committer au même instant. Sans le verrou
    consultatif dans la fonction trigger, chacune compte `0+1=1` avant de voir
    l'autre — les deux passent, l'invariant est violé. Avec lui, l'une des
    deux se bloque puis échoue en `IntegrityError` une fois l'autre commitée.

    Nécessite deux vraies connexions committant réellement : `session_postgres`
    ne peut pas porter ce test (voir la docstring du module). Nettoyage
    explicite en fin de test, rien n'étant annulé automatiquement ici.
    """
    id_client = 9101

    with engine_application.connect() as connexion:
        connexion.execute(
            text("ALTER TABLE client DISABLE TRIGGER trg_exclusivite_client_client")
        )
        connexion.execute(
            text(
                "INSERT INTO client (id_client, type_client, email, mot_de_passe) "
                "VALUES (:id, 'Particulier', :email, 'x')"
            ),
            {"id": id_client, "email": f"course{id_client}@delta.mg"},
        )
        connexion.execute(
            text("ALTER TABLE client ENABLE TRIGGER trg_exclusivite_client_client")
        )
        connexion.commit()

    resultats: dict[str, str] = {}
    barriere = threading.Barrier(2)

    def inserer(nom: str, sql: str) -> None:
        with engine_application.connect() as connexion:
            try:
                connexion.execute(text(sql), {"id": id_client})
                barriere.wait()
                connexion.commit()
                resultats[nom] = "commit_ok"
            except Exception:
                resultats[nom] = "rejete"

    fil_particulier = threading.Thread(
        target=inserer,
        args=(
            "particulier",
            "INSERT INTO client_particulier (id_client, nom, prenom) "
            "VALUES (:id, 'Rakoto', 'Jean')",
        ),
    )
    fil_entreprise = threading.Thread(
        target=inserer,
        args=(
            "entreprise",
            "INSERT INTO client_entreprise"
            " (id_client, raison_sociale, numero_id_fiscal)"
            " VALUES (:id, 'Delta SARL', 'FISC-COURSE')",
        ),
    )

    try:
        fil_particulier.start()
        fil_entreprise.start()
        fil_particulier.join()
        fil_entreprise.join()

        # Exactement l'un des deux a réussi, jamais les deux, jamais aucun —
        # l'insertion elle-même ne peut pas échouer pour une autre raison ici.
        assert sorted(resultats.values()) == ["commit_ok", "rejete"]

        with engine_application.connect() as connexion:
            total = connexion.execute(
                text(
                    "SELECT"
                    " (SELECT count(*) FROM client_particulier WHERE id_client = :id)"
                    " + (SELECT count(*) FROM client_entreprise WHERE id_client = :id)"
                ),
                {"id": id_client},
            ).scalar()
        assert total == 1
    finally:
        with engine_application.connect() as connexion:
            connexion.execute(
                text("DELETE FROM client_particulier WHERE id_client = :id"),
                {"id": id_client},
            )
            connexion.execute(
                text("DELETE FROM client_entreprise WHERE id_client = :id"),
                {"id": id_client},
            )
            connexion.execute(
                text("DELETE FROM client WHERE id_client = :id"), {"id": id_client}
            )
            connexion.commit()
