"""Configuration centralisée de l'application (pydantic-settings).

Toutes les valeurs sensibles ou dépendantes de l'environnement sont lues
depuis les variables d'environnement / le fichier `.env`. Aucun secret ne
doit être codé en dur ici.
"""

from typing import Literal

from pydantic import field_validator, model_validator
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

    # --- Impayés et acomptes (13 octobre 2026, cf. docs/mld.md) ---
    # Une commande non payée est annulée, son stock rendu, après ce délai.
    COMMANDE_DELAI_PAIEMENT_MINUTES: int = 120
    # Une réservation dont l'acompte n'est pas payé est annulée après ce délai.
    RESERVATION_DELAI_ACOMPTE_HEURES: int = 24
    # Part du prix exigée pour retenir une salle, une chambre ou une formation.
    ACOMPTE_POURCENTAGE: int = 30
    # Un paiement initié depuis moins longtemps protège de l'expiration : le
    # client est peut-être en train de valider sur son téléphone.
    EXPIRATION_GRACE_PAIEMENT_MINUTES: int = 30
    # Tâche périodique du serveur qui applique l'expiration. Les tests la
    # coupent ; `scripts/expirer_impayes.py` l'applique à la demande.
    EXPIRATION_AUTOMATIQUE: bool = True
    EXPIRATION_INTERVALLE_SECONDES: int = 300

    # --- Environnement d'exécution ---
    # Défaut fermé (`production`) : un déploiement qui omet cette variable
    # reste protégé plutôt que de se retrouver exposé par omission. Seul
    # `developpement` active les endpoints qui n'ont de sens que le temps
    # d'une simulation (voir `PaiementService`/`simuler_confirmation`,
    # Sprint 9.5, docs/mld.md).
    ENVIRONMENT: Literal["developpement", "production"] = "production"

    # --- Envoi d'e-mails (vérification de l'adresse, 14 octobre 2026) ---
    # Serveur SMTP standard : Gmail (mot de passe d'application), Brevo…
    # Vide : aucun e-mail ne part. En `developpement` seulement, un code de
    # vérification qui n'a pas pu partir (serveur absent ou qui refuse)
    # s'écrit dans le journal du serveur, pour pouvoir tester.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_UTILISATEUR: str = ""
    SMTP_MOT_DE_PASSE: str = ""
    #: Adresse affichée comme expéditeur ; l'utilisateur SMTP à défaut.
    SMTP_EXPEDITEUR: str = ""
    #: Durée de validité d'un code de vérification.
    CODE_VERIFICATION_MINUTES: int = 15

    # --- Assistant IA générative (Sprint 12) ---
    # Interrupteur général, **automatique par défaut** (décision du 7 octobre
    # 2026 : l'assistant doit rester allumé sans qu'on y pense). Non renseigné,
    # il s'allume dès que `GROQ_API_KEY` et la clé du fournisseur d'embeddings
    # (`HF_API_TOKEN`, `GOOGLE_API_KEY` ou `JINA_API_KEY`) sont présentes, et
    # reste éteint sinon — un poste sans clés démarre sans erreur. `false`
    # l'éteint explicitement (la CI, qui n'a aucune clé) ; `true` exige les
    # clés au démarrage. Résolu en booléen par le validateur ci-dessous : le
    # reste du code ne voit jamais `None`. Les dépendances du module vivent à
    # part, dans `requirements-ai.txt`.
    AI_ENABLED: bool | None = None
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
    # Fournisseur des embeddings. `google` ajouté le 9 octobre 2026 : le compte
    # Hugging Face n'avait plus de crédits (402) — décision de l'utilisateur,
    # un fournisseur à quota gratuit. Gemini (`gemini-embedding-001`, modèle
    # stable, multilingue), vecteurs réduits à 768 dimensions (valeur
    # recommandée par Google). Changer de fournisseur impose, comme changer de
    # modèle, une réindexation complète.
    #
    # `jina` ajouté le 12 octobre 2026 : Google a refusé l'accès au projet
    # (403). `jina-embeddings-v3`, multilingue, quota gratuit sans carte,
    # 1024 dimensions.
    EMBEDDINGS_FOURNISSEUR: Literal["huggingface", "google", "jina"] = "huggingface"
    GOOGLE_API_KEY: str = ""
    GOOGLE_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GOOGLE_EMBEDDING_DIMENSION: int = 768
    JINA_API_KEY: str = ""
    JINA_EMBEDDING_MODEL: str = "jina-embeddings-v3"
    JINA_EMBEDDING_DIMENSION: int = 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @field_validator("AI_ENABLED", mode="before")
    @classmethod
    def _vide_signifie_automatique(cls, valeur: object) -> object:
        """`AI_ENABLED=` laissé vide dans `.env` vaut « automatique », comme
        une ligne absente — et non une erreur de démarrage."""
        if isinstance(valeur, str) and not valeur.strip():
            return None
        return valeur

    @model_validator(mode="after")
    def _cles_ia_presentes_si_active(self) -> "Settings":
        """Résout le mode automatique, et refuse `true` sans les clés.

        Automatique (`None`) : allumé si et seulement si les deux clés sont
        présentes. Explicitement `true` sans elles : refus de démarrer, avec un
        message clair, plutôt qu'à la première question d'un visiteur — même
        principe que le reste de ce fichier.
        """
        manquantes = [
            nom
            for nom in ("GROQ_API_KEY", self.cle_embeddings)
            if not getattr(self, nom).strip()
        ]
        if self.AI_ENABLED is None:
            self.AI_ENABLED = not manquantes
        elif self.AI_ENABLED:
            if manquantes:
                raise ValueError(
                    "AI_ENABLED=true exige " + ", ".join(manquantes) + " dans .env."
                )
        return self

    @property
    def cle_embeddings(self) -> str:
        """Nom de la clé exigée par le fournisseur d'embeddings choisi."""
        return {
            "google": "GOOGLE_API_KEY",
            "jina": "JINA_API_KEY",
        }.get(self.EMBEDDINGS_FOURNISSEUR, "HF_API_TOKEN")

    @property
    def modele_embeddings(self) -> str:
        """Modèle d'embeddings réellement utilisé, quel que soit le fournisseur."""
        if self.EMBEDDINGS_FOURNISSEUR == "google":
            return self.GOOGLE_EMBEDDING_MODEL
        if self.EMBEDDINGS_FOURNISSEUR == "jina":
            return self.JINA_EMBEDDING_MODEL
        return self.LC_EMBEDDING_MODEL

    @property
    def cors_origins(self) -> list[str]:
        """Liste des origines CORS, dérivée de la chaîne séparée par virgules."""
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]


settings = Settings()
