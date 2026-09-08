"""Repository de l'entité CLIENT_PARTICULIER."""

from app.models.client_particulier import ClientParticulier
from app.repositories.base_repository import BaseRepository


class ClientParticulierRepository(BaseRepository[ClientParticulier]):
    """CRUD générique de CLIENT_PARTICULIER.

    Aucune méthode ajoutée : la recherche se fait toujours par `id_client`,
    que `get_by_id` couvre déjà (la PK de cette table *est* `id_client`).
    """

    modele = ClientParticulier
