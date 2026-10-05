"""Configuration centralisée de l'application (pydantic-settings).

Toutes les valeurs sensibles ou dépendantes de l'environnement sont lues
depuis les variables d'environnement / le fichier `.env`. Aucun secret ne
doit être codé en dur ici.
"""

from typing import Literal

from pydantic import model_validator
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

    # --- Photos du catalogue (salles, logements, formations, produits) ---
    # Un sous-dossier par partie, un fichier `<id>-<n>.<ext>` par photo (voir
    # `GalerieService`). Relatif au répertoire de travail du backend.
    # **Sur Render, ce disque est effacé à chaque déploiement** : voir la dette
    # « Photos du catalogue sur disque » dans `docs/roadmap.md`.
    UPLOAD_DIR: str = "static/upload"

    # --- Environnement d'exécution ---
    # Défaut fermé (`production`) : un déploiement qui omet cette variable
    # reste protégé plutôt que de se retrouver exposé par omission. Seul
    # `developpement` active les endpoints qui n'ont de sens que le temps
    # d'une simulation (voir `PaiementService`/`simuler_confirmation`,
    # Sprint 9.5, docs/mld.md).
    ENVIRONMENT: Literal["developpement", "production"] = "production"

    # --- Assistant IA générative (Sprint 12) ---
    # Interrupteur général, défaut fermé : tant qu'il vaut `false`, aucune
    # indexation ni aucun appel aux fournisseurs — la CI, qui n'a aucune clé
    # d'API, tourne dans cet état. Les dépendances du module vivent à part,
    # dans `requirements-ai.txt`.
    AI_ENABLED: bool = False
    # LLM — Groq, API distante. Modèle vérifié disponible sur le compte et
    # capable d'appel d'outils (nécessaire à l'agentique, 12.7).
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    # Embeddings — API d'inférence Hugging Face, jamais un modèle local : pas
    # de torch sur l'instance de déploiement. `BAAI/bge-m3` (1024 dimensions),
    # retenu sur mesure : sur un catalogue d'essai, il place le bon fragment
    # en tête 9 fois sur 10, contre 5 et 6 pour deux modèles multilingues plus
    # légers, et il est le seul à répondre correctement à des questions en
    # malgache (Sprint 12, 12.3, docs/roadmap.md). Changer de modèle impose une
    # réindexation complète : les vecteurs de deux modèles ne se comparent pas.
    HF_API_TOKEN: str = ""
    LC_EMBEDDING_MODEL: str = "BAAI/bge-m3"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @model_validator(mode="after")
    def _cles_ia_presentes_si_active(self) -> "Settings":
        """Refuse de démarrer avec l'assistant activé mais sans ses clés.

        Même principe que le reste de ce fichier : une configuration
        incomplète échoue au démarrage, avec un message clair, plutôt qu'à la
        première question d'un visiteur.
        """
        if self.AI_ENABLED:
            manquantes = [
                nom
                for nom in ("GROQ_API_KEY", "HF_API_TOKEN")
                if not getattr(self, nom).strip()
            ]
            if manquantes:
                raise ValueError(
                    "AI_ENABLED=true exige " + ", ".join(manquantes) + " dans .env."
                )
        return self

    @property
    def cors_origins(self) -> list[str]:
        """Liste des origines CORS, dérivée de la chaîne séparée par virgules."""
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]


settings = Settings()
