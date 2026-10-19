# Image du backend Delta (FastAPI) pour la production.
# Construite par docker-compose.prod.yml ; voir docs/deploiement.md.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dépendances d'abord, le code ensuite : une modification du code ne
# réinstalle pas tout. requirements-ai.txt : l'assistant IA est inclus
# (il ne s'allume que si ses clés sont dans .env.production). httpx est
# nommé explicitement : le client Jina s'en sert, et le socle ne le
# déclare qu'en dépendance de développement.
COPY pyproject.toml requirements-ai.txt ./
RUN mkdir app && touch app/__init__.py \
    && pip install . -r requirements-ai.txt "httpx>=0.27" \
    && pip uninstall -y delta-backend && rm -rf app build *.egg-info

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Utilisateur sans privilège ; il possède les dossiers des photos, montés
# en volumes pour survivre aux mises à jour.
RUN useradd --create-home --uid 1000 delta \
    && mkdir -p static/upload stockage/personnel_photos \
    && chown -R delta:delta /app \
    && chmod +x /usr/local/bin/docker-entrypoint.sh
USER delta

EXPOSE 8000
ENTRYPOINT ["docker-entrypoint.sh"]
