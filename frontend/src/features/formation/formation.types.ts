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

/**
 * Domaine en sortie des listes d'**administration**, archives comprises.
 *
 * Type distinct de `DomaineFormation`, miroir des deux schemas de sortie du
 * serveur : `supprime_le` n'est exposé que sur la route protégée, et le
 * déclarer sur le type public inviterait à l'attendre là où il n'arrive
 * jamais.
 */
export interface DomaineFormationAdministration extends DomaineFormation {
  /** `null` si actif, horodatage de l'archivage sinon. */
  supprime_le: string | null;
}

/** Charge utile de création ou modification d'un domaine. */
export interface DomaineFormationEnvoye {
  libelle: string;
  description?: string | null;
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
  /**
   * Calculée à la demande, **uniquement sur la fiche**
   * (`GET /formations/{id}`) — jamais sur la liste, non paginée (cf.
   * `docs/roadmap.md`, 8.3). Agrégée au niveau de la formation, toutes
   * sessions confondues. `null` tant qu'aucun avis actif n'existe, jamais
   * `0` : ce serait une moyenne valide.
   */
  note_moyenne: string | null;
  nombre_avis: number;
}

/**
 * Formation en sortie des listes d'**administration**, archives comprises.
 *
 * Type distinct de `Formation`, miroir des deux schemas de sortie du
 * serveur : `supprime_le` n'est exposé que sur la route protégée.
 */
export interface FormationAdministration extends Formation {
  /** `null` si active, horodatage de l'archivage sinon. */
  supprime_le: string | null;
}

/**
 * Charge utile de création d'une formation.
 *
 * Ni `id_formation` ni `supprime_le` : le premier est attribué par la base,
 * le second est un cycle de vie que seuls l'archivage et la restauration
 * écrivent.
 */
export interface FormationEnvoyee {
  titre: string;
  niveau?: string | null;
  duree_heures: number;
  prix: string;
  capacite_max: number;
  propose_hebergement?: boolean;
  id_domaine: number;
}

/**
 * Charge utile de modification — **partielle**.
 *
 * Le serveur n'écrit que les clés présentes : envoyer un objet complet
 * écraserait des colonnes que l'utilisateur n'a pas touchées.
 */
export type FormationModifiee = Partial<FormationEnvoyee>;

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
