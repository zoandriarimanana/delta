"""Tâche périodique d'expiration des impayés (13 octobre 2026)."""

import asyncio

import pytest

from app.core import expiration_periodique
from app.core.config import settings


def test_coupee_elle_ne_demarre_rien() -> None:
    """Ce que font les tests et la CI : aucune passe en arrière-plan."""
    assert settings.EXPIRATION_AUTOMATIQUE is False

    async def scenario() -> None:
        assert expiration_periodique.demarrer() is None

    asyncio.run(scenario())


def test_allumee_elle_tourne_puis_s_arrete_proprement(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    passes: list[int] = []
    monkeypatch.setattr(settings, "EXPIRATION_AUTOMATIQUE", True)
    monkeypatch.setattr(
        expiration_periodique, "passe_d_expiration", lambda: passes.append(1)
    )

    async def scenario() -> None:
        tache = expiration_periodique.demarrer()
        await asyncio.sleep(0.05)
        await expiration_periodique.arreter(tache)
        assert tache is not None and tache.done()

    asyncio.run(scenario())
    assert passes == [1]


def test_une_panne_ne_fait_jamais_tomber_la_boucle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class SessionEnPanne:
        def rollback(self) -> None: ...
        def close(self) -> None: ...

    def panne(_db: object) -> None:
        raise ConnectionError("base injoignable")

    monkeypatch.setattr(expiration_periodique, "SessionLocal", SessionEnPanne)
    monkeypatch.setattr(
        "app.services.expiration_service.ExpirationService.__init__",
        lambda self, db: None,
    )
    monkeypatch.setattr(
        "app.services.expiration_service.ExpirationService.expirer",
        lambda self: panne(None),
    )

    expiration_periodique.passe_d_expiration()  # ne lève pas
