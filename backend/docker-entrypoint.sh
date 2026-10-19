#!/bin/sh
# Démarrage du backend en production : migrations, puis serveur.
set -e

# Le schéma suit toujours le code déployé : une mise à jour qui apporte une
# migration l'applique ici, avant d'accepter la moindre requête.
alembic upgrade head

# Un seul processus : le limiteur de débit garde ses compteurs en mémoire
# (RATE_LIMIT_STORAGE_URI=memory://), plusieurs processus multiplieraient
# les limites (dette T0.6, docs/roadmap.md).
# --proxy-headers : derrière Caddy, l'adresse du visiteur vient de
# X-Forwarded-For ; sans lui, toutes les limites par IP compteraient le
# même client (le proxy).
exec uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips="*"
