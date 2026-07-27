/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API, préfixe inclus (ex. http://localhost:8000/api/v1). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
