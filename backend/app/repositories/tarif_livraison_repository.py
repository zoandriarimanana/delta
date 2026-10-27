"""Repository de l'entité TARIF_LIVRAISON.

Le CRUD générique suffit : la table n'a qu'une ligne, lue par `get_by_id`.
"""

from app.models.tarif_livraison import TarifLivraison
from app.repositories.base_repository import BaseRepository


class TarifLivraisonRepository(BaseRepository[TarifLivraison]):
    """Aucune méthode au-delà du CRUD générique."""

    modele = TarifLivraison
