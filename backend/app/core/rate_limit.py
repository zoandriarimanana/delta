"""Limiteur de débit (dette technique T0.6, docs/roadmap.md).

Isolé de `main.py` pour la même raison que `security.py`/`deps.py` sont
séparés : un module dédié à une seule responsabilité transverse, importable
par les routers qui en ont besoin sans dépendre de l'assemblage de
l'application.

Le backend de stockage vient de `Settings.RATE_LIMIT_STORAGE_URI`
(`memory://` par défaut) — c'est la seule chose qui changerait pour passer à
Redis, aucun code applicatif ici ni dans les routers décorés.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

#: Clé par adresse IP : c'est le client réseau qu'on veut freiner, pas un
#: compte particulier — un compte n'a d'ailleurs pas encore d'identité connue
#: au moment où la tentative de connexion arrive.
limiter = Limiter(
    key_func=get_remote_address, storage_uri=settings.RATE_LIMIT_STORAGE_URI
)

#: Limite appliquée aux deux endpoints de connexion (CLIENT et PERSONNEL) —
#: une seule constante, pour que les deux évoluent ensemble plutôt que de
#: diverger silencieusement si l'une est ajustée sans l'autre.
LIMITE_CONNEXION = "5/minute"

# Assistant IA (Sprint 12) : routes publiques, et chaque question coûte un
# appel facturé chez Groq et Hugging Face. Plus large que la connexion — une
# conversation enchaîne naturellement plusieurs questions —, mais assez bas
# pour qu'un script ne vide pas le quota du mois en une après-midi.
LIMITE_ASSISTANT = "10/minute"

# Paiement d'une commande invitée (9 octobre 2026) : route publique, la seule
# clé est l'UUID de la commande. Chaque appel crée une ligne `PAIEMENT` et une
# demande chez l'opérateur — une vraie personne ne réessaie pas dix fois par
# minute, un script si.
LIMITE_PAIEMENT_INVITE = "10/minute"

#: Demande de formation sur commande (14 octobre 2026) : formulaire public,
#: donc cible de spam — quelques envois par minute suffisent à un humain.
LIMITE_DEMANDE_FORMATION = "5/minute"
