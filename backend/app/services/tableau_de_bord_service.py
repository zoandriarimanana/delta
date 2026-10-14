"""Tableau de bord de l'administration (14 octobre 2026).

Service d'**orchestration** : il croise `COMMANDE`, `LIGNE_COMMANDE`,
`DEMANDE_PERSONNALISATION` et `PRODUIT`, d'où un fichier à part, comme
`ExpirationService`. Rien n'est stocké : tout se calcule à la demande, même
principe que `calculer_solde()` (Sprint 7.2).
"""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.commande import StatutCommande
from app.repositories.commande_repository import CommandeRepository
from app.repositories.ligne_commande_repository import LigneCommandeRepository
from app.schemas.tableau_de_bord import (
    Periode,
    PointVentes,
    TableauDeBordRead,
    VenteProduitRead,
    VentesCategorie,
)

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

#: Les jours se comptent à l'heure de Madagascar, celle de la boutique.
FUSEAU = "Indian/Antananarivo"


def _mois_suivant(jour: date) -> date:
    return date(jour.year + jour.month // 12, jour.month % 12 + 1, 1)


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
        journalier = periode in (Periode.SEPT_JOURS, Periode.TRENTE_JOURS)
        maintenant = maintenant or datetime.now(UTC)
        depuis = None if duree is None else maintenant - duree
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
            pas="jour" if journalier else "mois",
            evolution=self._evolution(depuis, maintenant, journalier),
            categories=self._categories(ventes),
        )

    def _evolution(
        self, depuis: datetime | None, maintenant: datetime, journalier: bool
    ) -> list[PointVentes]:
        """Points de la courbe, **sans trou** : un jour ou un mois sans vente
        vaut zéro, sinon la courbe relierait deux ventes éloignées comme si
        elles se suivaient."""
        lus = {
            debut: (n, montant)
            for debut, n, montant in self.commandes.serie(
                STATUTS_VENDUS, depuis, "day" if journalier else "month", FUSEAU
            )
        }
        fuseau = ZoneInfo(FUSEAU)
        fin = maintenant.astimezone(fuseau).date()
        if depuis is not None:
            jour = depuis.astimezone(fuseau).date()
        elif lus:
            jour = min(lus)
        else:
            return []
        points = []
        if not journalier:
            jour, fin = jour.replace(day=1), fin.replace(day=1)
        while jour <= fin:
            n, montant = lus.get(jour, (0, Decimal(0)))
            points.append(
                PointVentes(debut=jour, nombre_commandes=n, chiffre_affaires=montant)
            )
            jour = jour + timedelta(days=1) if journalier else _mois_suivant(jour)
        return points

    @staticmethod
    def _categories(ventes) -> list[VentesCategorie]:
        cumul: dict[str, tuple[int, Decimal]] = {}
        for v in ventes:
            u, m = cumul.get(v.categorie, (0, Decimal(0)))
            cumul[v.categorie] = (u + v.unites_vendues, m + v.chiffre_affaires)
        return sorted(
            (
                VentesCategorie(categorie=c, unites_vendues=u, chiffre_affaires=m)
                for c, (u, m) in cumul.items()
            ),
            key=lambda c: (-c.chiffre_affaires, c.categorie),
        )
