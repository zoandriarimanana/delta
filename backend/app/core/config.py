"""Configuration centralisée de l'application (pydantic-settings).

Toutes les valeurs sensibles ou dépendantes de l'environnement sont lues
depuis les variables d'environnement / le fichier `.env`. Aucun secret ne
doit être codé en dur ici.
"""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Paramètres applicatifs chargés depuis l'environnement."""

    # --- Base de données ---
    DATABASE_URL: str

    # --- Identifiants du conteneur PostgreSQL ---
    # Non utilisés par l'application, qui passe exclusivement par DATABASE_URL :
    # ils sont lus par `docker-compose.yml` via `env_file`. Ils sont malgré tout
    # déclarés ici pour que le `.env` reste intégralement validé — une clé
    # manquante ou mal orthographiée échoue au démarrage de l'API, avec un
    # message clair, plutôt que silencieusement au `docker compose up`.
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # --- Sécurité / JWT ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- API ---
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Delta"

    # --- CORS (origines autorisées, séparées par des virgules) ---
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    # --- Rate limiting (dette technique T0.6) ---
    # URI du backend de stockage `slowapi`/`limits`. `memory://` par défaut :
    # correct pour un déploiement mono-processus/mono-instance, seul cas
    # existant aujourd'hui (aucun plan de déploiement multi-workers dans ce
    # projet). Devient incorrect (limite multipliée par le nombre de workers)
    # dès qu'un déploiement en scale plusieurs — passer alors à
    # `redis://hôte:port`, un simple changement de configuration, le code
    # applicatif n'a pas à changer. Voir docs/roadmap.md, Dette technique.
    RATE_LIMIT_STORAGE_URI: str = "memory://"

    # --- Stockage des photos de profil PERSONNEL ---
    # Dossier dédié sur disque, jamais un blob en base ni un stockage d'objets
    # externe (scope volontairement réduit). Chemin relatif au répertoire de
    # travail du process backend — configurable, jamais codé en dur dans le
    # service qui l'utilise (`PersonnelService`).
    PHOTO_STORAGE_DIR: str = "stockage/personnel_photos"

    # --- Environnement d'exécution ---
    # Défaut fermé (`production`) : un déploiement qui omet cette variable
    # reste protégé plutôt que de se retrouver exposé par omission. Seul
    # `developpement` active les endpoints qui n'ont de sens que le temps
    # d'une simulation (voir `PaiementService`/`simuler_confirmation`,
    # Sprint 9.5, docs/mld.md).
    ENVIRONMENT: Literal["developpement", "production"] = "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @property
    def cors_origins(self) -> list[str]:
        """Liste des origines CORS, dérivée de la chaîne séparée par virgules."""
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]


settings = Settings()
