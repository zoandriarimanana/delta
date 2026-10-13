"""Prix et acompte d'une réservation — fonctions pures (13 octobre 2026).

Le prix est **calculé par le serveur et figé** à la création, comme
`COMMANDE.montant_total` : il ne vient jamais de la requête, et une
modification de tarif ne rétroagit pas sur une réservation déjà faite.

Rien ici ne touche la base : `ReservationService` passe les biens déjà
chargés, ce qui rend chaque règle testable seule.
"""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from math import ceil

from app.models.formation import Formation
from app.models.logement import Logement
from app.models.salle import Salle

CENTIME = Decimal("0.01")


def _heures(debut: datetime, fin: datetime) -> float:
    return (fin - debut).total_seconds() / 3600


def prix_salle(salle: Salle, debut: datetime, fin: datetime) -> Decimal:
    """Le **moins cher** des tarifs que la salle porte : heures entamées ×
    tarif horaire, ou jours entamés × tarif journalier.

    Une salle peut n'avoir qu'un des deux tarifs (cf. `docs/mld.md`, `CHECK`
    « au moins un ») : seuls ceux qui existent sont comparés. Le client paie
    toujours la formule qui lui est la plus favorable — personne n'a à
    choisir entre « à l'heure » et « à la journée ».
    """
    duree = _heures(debut, fin)
    options = []
    if salle.tarif_horaire is not None:
        options.append(salle.tarif_horaire * ceil(duree))
    if salle.tarif_journee is not None:
        options.append(salle.tarif_journee * ceil(duree / 24))
    return min(options).quantize(CENTIME)


def prix_logement(logement: Logement, debut: datetime, fin: datetime) -> Decimal:
    """Nuits entamées × tarif à la nuitée, une nuit au moins. Le prix est
    celui de la chambre, quel que soit le nombre de personnes."""
    nuits = max(1, ceil(_heures(debut, fin) / 24))
    return (logement.tarif_nuitee * nuits).quantize(CENTIME)


def prix_formation(formation: Formation, nombre_personnes: int) -> Decimal:
    """Prix de la formation × nombre de personnes : il est fixé par personne."""
    return (formation.prix * nombre_personnes).quantize(CENTIME)


def acompte(total: Decimal, pourcentage: int) -> Decimal | None:
    """Part du prix exigée pour retenir la réservation, arrondie au centime
    au demi supérieur — même arrondi que les devises.

    `None` pour un prix nul : une salle gratuite (`0.00`, cf. `docs/mld.md`)
    n'a rien à garantir, et n'expirera donc jamais faute d'acompte.
    """
    if total <= 0:
        return None
    return (total * pourcentage / 100).quantize(CENTIME, rounding=ROUND_HALF_UP)
