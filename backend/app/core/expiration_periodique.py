"""Tâche périodique d'expiration des impayés (13 octobre 2026).

Lancée au démarrage de l'application, elle applique `ExpirationService`
toutes les `EXPIRATION_INTERVALLE_SECONDES`. Le travail, synchrone (session
SQLAlchemy), tourne dans un fil à part pour ne jamais bloquer les requêtes.

**Une seule instance du serveur** est supposée — c'est la cible actuelle
(cf. dette Redis dans `docs/roadmap.md`). Plusieurs instances feraient
chacune leur passe : sans danger (l'annulation refuse ce qui l'est déjà),
seulement redondant. `scripts/expirer_impayes.py` applique la même passe à
la demande, par exemple depuis une tâche planifiée externe.
"""

import asyncio
from contextlib import suppress

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger

journal = get_logger(__name__)


def passe_d_expiration() -> None:
    """Une passe, dans sa propre session. Ne lève jamais : une panne (base
    injoignable) se journalise, la passe suivante réessaiera."""
    from app.services.expiration_service import ExpirationService

    db = SessionLocal()
    try:
        ExpirationService(db).expirer()
    except Exception:
        db.rollback()
        journal.exception("Passe d'expiration des impayés échouée")
    finally:
        db.close()


async def _boucle() -> None:
    while True:
        await asyncio.to_thread(passe_d_expiration)
        await asyncio.sleep(settings.EXPIRATION_INTERVALLE_SECONDES)


def demarrer() -> asyncio.Task[None] | None:
    """Démarre la boucle, ou rien si `EXPIRATION_AUTOMATIQUE` est coupé."""
    if not settings.EXPIRATION_AUTOMATIQUE:
        return None
    return asyncio.create_task(_boucle())


async def arreter(tache: asyncio.Task[None] | None) -> None:
    if tache is None:
        return
    tache.cancel()
    with suppress(asyncio.CancelledError):
        await tache
