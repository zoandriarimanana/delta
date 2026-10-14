"""Tableau de bord de l'administration (14 octobre 2026).

Service d'**orchestration** : il croise `COMMANDE`, `LIGNE_COMMANDE`,
`DEMANDE_PERSONNALISATION` et `PRODUIT`, d'où un fichier à part, comme
`ExpirationService`. Rien n'est stocké : tout se calcule à la demande, même
principe que `calculer_solde()` (Sprint 7.2).
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.commande import StatutCommande
from app.repositories.commande_repository import CommandeRepository
from app.repositories.ligne_commande_repository import LigneCommandeRepository
from app.schemas.tableau_de_bord import Periode, TableauDeBordRead, VenteProduitRead

#: Ce qui compte comme une vente : une commande **engagée**. Une commande en
#: attente peut encore expirer, une annulée n'a rien vendu.
STATUTS_VENDUS: tuple[StatutCommande, ...] = (
    StatutCommande.CONFIRMEE,
    StatutCommande.EN_PREPARATION,
    StatutCommande.LIVREE,
    StatutCommande.SERVIE,
)

DUREES: dict[Periode, timedelta | None] = {
    Periode.SEPT_JOURS: timedelta(days=7),
    Periode.TRENTE_JOURS: timedelta(days=30),
    Periode.DOUZE_MOIS: timedelta(days=365),
    Periode.TOUT: None,
}

CENTIME = Decimal("0.01")


class TableauDeBordService:
    """Chiffres clés et classement des produits les plus vendus."""

    def __init__(self, db: Session) -> None:
        self.commandes = CommandeRepository(db)
        self.lignes = LigneCommandeRepository(db)

    def calculer(
        self, periode: Periode, maintenant: datetime | None = None
    ) -> TableauDeBordRead:
        """Tableau de bord de la période. `maintenant` n'existe que pour les
        tests."""
        duree = DUREES[periode]
        depuis = None if duree is None else (maintenant or datetime.now(UTC)) - duree
        nombre, chiffre = self.commandes.totaux(STATUTS_VENDUS, depuis)
        ventes = sorted(
            self.lignes.ventes_par_produit(STATUTS_VENDUS, depuis),
            key=lambda v: (-v.unites_vendues, -v.chiffre_affaires, v.nom),
        )
        return TableauDeBordRead(
            periode=periode,
            chiffre_affaires=chiffre,
            nombre_commandes=nombre,
            panier_moyen=(chiffre / nombre).quantize(CENTIME) if nombre else Decimal(0),
            commandes_a_confirmer=self.commandes.compter_actives(
                StatutCommande.EN_ATTENTE
            ),
            produits=[VenteProduitRead(**v._asdict()) for v in ventes],
        )
