/**
 * Types du module formation, relevés du schéma OpenAPI.
 *
 * `prix` arrive en **chaîne** : c'est un `Decimal` côté serveur, que FastAPI
 * sérialise ainsi pour ne pas perdre de précision au passage par le flottant
 * JSON. Même convention que `produit.types.ts` et `commande.types.ts`.
 */

export type StatutSessionFormation = 'Planifiee' | 'Ouverte' | 'Terminee' | 'Annulee';

export interface DomaineFormation {
  id_domaine: number;
  libelle: string;
  description: string | null;
}

export interface Formation {
  id_formation: number;
  titre: string;
  niveau: string | null;
  duree_heures: number;
  prix: string;
  capacite_max: number;
  propose_hebergement: boolean;
  id_domaine: number;
}

/**
 * Formateur tel que l'API le renvoie — miroir de `FormateurPublic`.
 *
 * Ni `email`, ni `telephone` : le serveur ne les envoie pas, et ce type ne les
 * déclare pas non plus. Les déclarer inviterait à les attendre, puis à les
 * afficher le jour où quelqu'un élargirait le schema de sortie.
 */
export interface FormateurPublic {
  nom: string;
  prenom: string;
  specialite: string | null;
}

export interface SessionFormation {
  id_session: number;
  date_debut: string;
  date_fin: string;
  places_restantes: number;
  statut: StatutSessionFormation;
  id_formation: number;
  /** `null` tant qu'aucun formateur n'est affecté. */
  formateur: FormateurPublic | null;
}
