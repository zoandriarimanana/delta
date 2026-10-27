"""ajoute le trigger d exclusivite client

Revision ID: 4cfa278b3371
Revises: fb2aad84bf48
Create Date: 2026-09-08 13:17:59.513058

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4cfa278b3371"
down_revision: str | Sequence[str] | None = "fb2aad84bf48"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Dette technique T0.7 (docs/roadmap.md, Sprint 11) : la contrainte n°1 du MLD
# n'etait garantie qu'au niveau applicatif, dans AuthService (creation CLIENT +
# ligne fille dans une seule transaction) — contournable par tout ecrivain hors
# API (import SQL, script de seed, correction manuelle en base).
#
# ECRITE A LA MAIN : l'autogeneration d'Alembic ne compare pas les fonctions ni
# les triggers, comme elle ne compare pas les CHECK ou les EXCLUDE (cf.
# migration acadf9ddce27).
FONCTION = """
CREATE FUNCTION verifier_exclusivite_client() RETURNS trigger AS $$
DECLARE
  nb integer;
BEGIN
  -- Verrou consultatif transactionnel, cle sur id_client : serialise toutes
  -- les verifications concurrentes pour ce client. Indispensable — sans lui,
  -- deux transactions ajoutant chacune une ligne fille differente au meme
  -- client orphelin peuvent chacune compter 0+1=1 avant que l'autre ne
  -- committe, laissant passer les deux (race empiriquement confirmee en
  -- construisant cette migration, avec deux connexions concurrentes).
  --
  -- Pas un simple `SELECT ... FOR UPDATE` sur la ligne `client` : celui-ci
  -- entre en deadlock avec le verrou FOR KEY SHARE que PostgreSQL pose deja
  -- implicitement sur cette meme ligne pour honorer les FK de
  -- client_particulier/client_entreprise au moment de l'INSERT — chaque
  -- transaction detient KEY SHARE et tente d'upgrader vers UPDATE, cycle
  -- classique (confirme empiriquement). Le verrou consultatif est totalement
  -- independant de ce systeme de verrous de lignes/FK.
  PERFORM pg_advisory_xact_lock(NEW.id_client);

  SELECT (SELECT count(*) FROM client_particulier WHERE id_client = NEW.id_client)
       + (SELECT count(*) FROM client_entreprise WHERE id_client = NEW.id_client)
  INTO nb;

  IF nb <> 1 THEN
    RAISE EXCEPTION 'Le client % doit porter exactement une ligne fille (particulier'
      ' xor entreprise), en a %', NEW.id_client, nb
      -- SQLSTATE de la classe 23 (integrity constraint violation), la meme
      -- que celle d'un vrai CHECK : SQLAlchemy la traduit en IntegrityError,
      -- cohérent avec tout ce que le reste du code intercepte deja par ce
      -- type (cf. AuthService._est_conflit_email).
      USING ERRCODE = 'check_violation';
  END IF;

  -- Ignore pour un trigger AFTER : la ligne n'est de toute facon plus
  -- modifiable a ce stade.
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""

# Un seul trigger sur `client` seule couvrirait « aucune ligne fille » mais pas
# « les deux », ajoutees dans deux transactions distinctes apres coup ; un
# trigger sur les deux tables filles seules couvrirait l'inverse. DEFERRABLE
# INITIALLY DEFERRED sur les trois : au moment precis de l'INSERT sur `client`,
# aucune ligne fille n'existe encore (l'app les insere juste apres, dans la
# meme transaction) — un trigger immediat echouerait donc systematiquement,
# y compris sur le chemin normal de l'API. Verifier au commit laisse la
# transaction se terminer avant de trancher.
TABLES = ("client", "client_particulier", "client_entreprise")


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(FONCTION)
    for table in TABLES:
        op.execute(
            f"CREATE CONSTRAINT TRIGGER trg_exclusivite_client_{table}"
            f" AFTER INSERT ON {table}"
            f" DEFERRABLE INITIALLY DEFERRED"
            f" FOR EACH ROW EXECUTE FUNCTION verifier_exclusivite_client()"
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table in TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS trg_exclusivite_client_{table} ON {table}")
    op.execute("DROP FUNCTION IF EXISTS verifier_exclusivite_client()")
