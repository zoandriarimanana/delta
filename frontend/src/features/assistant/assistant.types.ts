/**
 * Types de l'assistant IA (Sprint 12) — miroir de `backend/app/schemas/assistant.py`.
 *
 * Aucune entité du MLD derrière : l'assistant lit le catalogue public au
 * travers de son index.
 */

/** Fiche du catalogue dont provient une partie de la réponse. */
export interface SourceAssistant {
  type_contenu: string;
  id_contenu: number;
  /** Absent des fragments indexés avant l'ajout du titre. */
  titre: string | null;
}

/**
 * Événement du flux SSE de `POST /assistant/question/flux`.
 *
 * `erreur` n'arrive que si le fournisseur tombe **pendant** la génération :
 * avant le premier jeton, le serveur répond encore un vrai 503.
 */
export type EvenementFlux =
  { jeton: string } | { fin: true; sources: SourceAssistant[] } | { erreur: string };

export type AuteurMessage = 'visiteur' | 'assistant';

export interface MessageConversation {
  id: number;
  auteur: AuteurMessage;
  texte: string;
  sources: SourceAssistant[];
  /** Vrai tant que les jetons de la réponse arrivent. */
  enCours: boolean;
  /** Vrai si la réponse a échoué — le texte porte alors le message d'erreur. */
  erreur: boolean;
}

export interface DisponibiliteAssistant {
  actif: boolean;
}

export interface EtatAssistant {
  actif: boolean;
  llm_joignable: boolean;
  modele_llm: string;
  modele_embeddings: string;
  fragments_par_type: Record<string, number>;
  total_fragments: number;
}

export interface CompteIndexation {
  elements: number;
  fragments: number;
}

export interface ReindexationAssistant {
  par_type: Record<string, CompteIndexation>;
  total_fragments: number;
}

/**
 * Qui interroge l'assistant. `personnel` lit aussi le guide du back-office et
 * les documents internes ; c'est le **serveur** qui l'accorde, d'après la
 * session — le choisir côté client ne contourne rien.
 */
export type ProfilAssistant = 'client' | 'personnel';

/** Public d'un document de la base de connaissances. */
export type PublicCible = 'Client' | 'Personnel';

export type TypeFichier = 'pdf' | 'docx' | 'txt' | 'md';

/** Miroir de `DocumentConnaissanceRead` — le texte complet n'est jamais renvoyé. */
export interface DocumentConnaissance {
  id_document: number;
  titre: string;
  nom_fichier: string;
  type_fichier: TypeFichier;
  taille_octets: number;
  public_cible: PublicCible;
  date_ajout: string;
  id_personnel: number;
  supprime_le: string | null;
  apercu: string;
  /** `null` assistant coupé ; `0` sur un document actif : indexation à relancer. */
  nombre_fragments: number | null;
}
