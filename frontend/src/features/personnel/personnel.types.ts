/**
 * Types du module personnel, calqués sur le contrat réel de l'API.
 *
 * Relevés depuis les schemas Pydantic, pas depuis les modèles SQLAlchemy.
 */

export type FonctionPersonnel =
  'Formateur' | 'Livreur' | 'Cuisinier' | 'Receptionniste' | 'Autre';

export interface Personnel {
  id_personnel: number;
  nom: string;
  prenom: string;
  fonction: FonctionPersonnel;
  email: string;
  telephone: string | null;
  date_embauche: string | null;
  specialite: string | null;
  zone_livraison: string | null;
  /**
   * Lisible, jamais écrivable depuis ce module : ni `PersonnelEnvoye` ni
   * `PersonnelModifie` ne portent ce champ, structurellement — même
   * protection que côté serveur (`PersonnelCreate`/`PersonnelUpdate`
   * l'excluent aussi). La promotion administrateur n'a pas d'écran ; elle
   * reste hors périmètre (cf. `docs/architecture.md`).
   */
  est_administrateur: boolean;
}

/**
 * Charge utile de création/modification.
 *
 * **`est_administrateur` et `mot_de_passe` sont délibérément absents** — les
 * mêmes deux colonnes que le serveur refuse déjà d'accepter, quel que soit
 * l'appelant. Les omettre ici est redondant avec la protection serveur, mais
 * un champ qu'aucun formulaire ne propose est un champ qu'aucun clic ne peut
 * envoyer par erreur.
 */
export interface PersonnelEnvoye {
  nom: string;
  prenom: string;
  fonction: FonctionPersonnel;
  email: string;
  telephone?: string | null;
  date_embauche?: string | null;
  specialite?: string | null;
  zone_livraison?: string | null;
}

/** Mise à jour partielle : seuls les champs fournis sont écrits côté serveur. */
export type PersonnelModifie = Partial<PersonnelEnvoye>;
