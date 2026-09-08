"""Tests des validateurs de AvisCreate — dupliquent les CHECK posés en base."""

import pytest
from pydantic import ValidationError

from app.schemas.avis import AvisCreate


def test_produit_avec_id_ligne_est_valide() -> None:
    AvisCreate(type_avis="Produit", note=5, id_ligne=1)


def test_service_avec_id_reservation_est_valide() -> None:
    AvisCreate(type_avis="Service", note=5, id_reservation=1)


def test_produit_avec_id_reservation_est_refuse() -> None:
    with pytest.raises(ValidationError):
        AvisCreate(type_avis="Produit", note=5, id_reservation=1)


def test_service_avec_id_ligne_est_refuse() -> None:
    with pytest.raises(ValidationError):
        AvisCreate(type_avis="Service", note=5, id_ligne=1)


def test_aucune_cible_est_refusee() -> None:
    with pytest.raises(ValidationError):
        AvisCreate(type_avis="Produit", note=5)


def test_deux_cibles_est_refuse() -> None:
    with pytest.raises(ValidationError):
        AvisCreate(type_avis="Produit", note=5, id_ligne=1, id_reservation=1)


def test_note_hors_bornes_est_refusee() -> None:
    with pytest.raises(ValidationError):
        AvisCreate(type_avis="Produit", note=6, id_ligne=1)
