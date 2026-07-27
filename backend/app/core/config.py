"""Configuration centralisée de l'application (pydantic-settings).

Toutes les valeurs sensibles ou dépendantes de l'environnement sont lues
depuis les variables d'environnement / le fichier `.env`. Aucun secret ne
doit être codé en dur ici.
"""

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
