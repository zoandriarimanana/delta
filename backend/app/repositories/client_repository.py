"""Repository de l'entité CLIENT."""

from sqlalchemy import select

from app.models.client import Client
from app.repositories.base_repository import BaseRepository


class ClientRepository(BaseRepository[Client]):
    """CRUD générique de CLIENT, plus la recherche par e-mail.

    L'e-mail est l'identifiant de connexion (`UNIQUE` en base, cf.
    `docs/mld.md`) : cette recherche est donc le point d'entrée de tout le
    parcours d'authentification.
    """

    modele = Client

    def get_by_email(self, email: str) -> Client | None:
        """Retourne le client portant cet e-mail, ou None.

        Ne peut pas remonter plus d'une ligne : `uq_client_email` le garantit
        en base.
        """
        return self.db.scalars(
            select(Client).where(Client.email == email)
        ).one_or_none()
