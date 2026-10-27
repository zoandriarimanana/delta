"""Prix et acompte d'une réservation (13 octobre 2026) — fonctions pures."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.prix_reservation import (
    acompte,
    prix_formation,
    prix_logement,
    prix_salle,
)

DEBUT = datetime(2026, 11, 2, 8, 0, tzinfo=UTC)


def _salle(horaire: str | None, journee: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        tarif_horaire=None if horaire is None else Decimal(horaire),
        tarif_journee=None if journee is None else Decimal(journee),
    )


@pytest.mark.parametrize(
    ("heures", "horaire", "journee", "attendu"),
    [
        # 3 h : 3 × 20 000 = 60 000, moins cher que 1 jour à 150 000.
        (3, "20000", "150000", "60000.00"),
        # 10 h : 200 000 à l'heure, 150 000 à la journée → la journée.
        (10, "20000", "150000", "150000.00"),
        # Une heure entamée compte : 2 h 30 → 3 heures.
        (2.5, "20000", None, "60000.00"),
        # Seul le tarif journalier existe : 30 h → 2 jours.
        (30, None, "100000", "200000.00"),
    ],
)
def test_prix_salle_au_moins_cher(
    heures: float, horaire: str | None, journee: str | None, attendu: str
) -> None:
    fin = DEBUT + timedelta(hours=heures)

    assert prix_salle(_salle(horaire, journee), DEBUT, fin) == Decimal(attendu)


def test_prix_logement_par_nuit_entamee() -> None:
    chambre = SimpleNamespace(tarif_nuitee=Decimal("45000"))

    assert prix_logement(chambre, DEBUT, DEBUT + timedelta(hours=50)) == Decimal(
        "135000.00"
    )
    # Une nuit au moins, même pour quelques heures.
    assert prix_logement(chambre, DEBUT, DEBUT + timedelta(hours=3)) == Decimal(
        "45000.00"
    )


def test_prix_formation_par_personne() -> None:
    formation = SimpleNamespace(prix=Decimal("50000"))

    assert prix_formation(formation, 3) == Decimal("150000.00")


def test_acompte_de_30_pour_cent_arrondi_au_centime() -> None:
    assert acompte(Decimal("150000.00"), 30) == Decimal("45000.00")
    assert acompte(Decimal("10.05"), 30) == Decimal("3.02")  # 3.015 → 3.02


def test_un_prix_nul_ne_demande_pas_d_acompte() -> None:
    """Une salle gratuite n'a rien à garantir : elle n'expirera jamais."""
    assert acompte(Decimal("0.00"), 30) is None
