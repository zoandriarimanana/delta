"""Service métier de TARIF_LIVRAISON — et le calcul des frais d'une commande."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import RessourceIntrouvable
from app.models.tarif_livraison import ID_TARIF, TarifLivraison
from app.repositories.tarif_livraison_repository import TarifLivraisonRepository
from app.schemas.tarif_livraison import TarifLivraisonUpdate

ZERO = Decimal("0")


class TarifLivraisonService:
    """Lecture et réglage du tarif, et la seule règle de calcul des frais."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.tarifs = TarifLivraisonRepository(db)

    def obtenir(self) -> TarifLivraison:
        """L'unique ligne de tarif, posée par la migration.

        Son absence est une base mal migrée, jamais un état normal.
        """
        tarif = self.tarifs.get_by_id(ID_TARIF)
        if tarif is None:
            raise RessourceIntrouvable("Tarif de livraison introuvable.")
        return tarif

    def modifier(self, donnees: TarifLivraisonUpdate) -> TarifLivraison:
        """Applique les seules clés envoyées.

        Ne touche aucune commande existante : leurs frais sont figés.
        """
        tarif = self.obtenir()
        self.tarifs.update(tarif, donnees.model_dump(exclude_unset=True))
        self.db.commit()
        return tarif

    def calculer_frais(self, sous_total: Decimal) -> Decimal:
        """Frais d'une commande livrée, pour un montant de produits donné.

        **Le seul endroit** où la règle vit : forfait, une fois par commande,
        offert si `sous_total >= seuil_gratuite`. Le seuil se compare aux
        **produits** (personnalisations comprises), jamais à un total qui
        contiendrait déjà les frais — sinon le forfait aiderait à atteindre sa
        propre gratuité.
        """
        tarif = self.obtenir()
        if tarif.seuil_gratuite is not None and sous_total >= tarif.seuil_gratuite:
            return ZERO
        return tarif.forfait
