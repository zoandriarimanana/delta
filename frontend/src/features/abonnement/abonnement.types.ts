/**
 * Types du module abonnement, calqués sur le contrat réel de l'API.
 *
 * Relevés depuis les schemas Pydantic, pas depuis les modèles SQLAlchemy :
 * c'est ce que le client reçoit qui compte.
 */

export type TypeFacturation = 'Forfait' | 'Consommation_reelle';
export type ModeSuivi = 'Individuel' | 'Global';
export type StatutBeneficiaire = 'Actif' | 'Inactif' | 'Suspendu';

export interface Abonnement {
  id_abonnement: number;
  date_debut: string;
  date_fin: string;
  type_facturation: TypeFacturation;
  mode_suivi: ModeSuivi;
  nombre_repas_inclus: number | null;
  /** Chaîne, pas nombre : `Decimal` côté serveur, sérialisé en chaîne pour ne
   * pas perdre de précision au passage par le flottant JSON. */
  tarif_forfait: string | null;
  tarif_unitaire_repas: string | null;
  id_client_entreprise: number;
}

/**
 * Charge utile de création, côté administration.
 *
 * `id_client_entreprise` y figure explicitement : côté admin, ce n'est pas
 * l'identité de l'appelant mais une référence à désigner — d'où le sélecteur
 * alimenté par `GET /clients-entreprise/administration`.
 */
export interface AbonnementEnvoye {
  date_debut: string;
  date_fin: string;
  type_facturation: TypeFacturation;
  mode_suivi: ModeSuivi;
  nombre_repas_inclus?: number | null;
  tarif_forfait?: string | null;
  tarif_unitaire_repas?: string | null;
  id_client_entreprise: number;
}

/** Mise à jour partielle. `id_client_entreprise` n'est jamais réassignable. */
export type AbonnementModifie = Partial<Omit<AbonnementEnvoye, 'id_client_entreprise'>>;

/**
 * Solde calculé à la demande — jamais stocké côté serveur (aucune entité
 * FACTURE, cf. `docs/roadmap.md`). `repas_restants` n'a de sens qu'au forfait ;
 * `null` et non `0` en consommation réelle, pour ne pas suggérer un quota
 * épuisé qui n'existe pas dans ce mode.
 */
export interface SoldeAbonnement {
  id_abonnement: number;
  type_facturation: TypeFacturation;
  repas_consommes: number;
  repas_inclus: number | null;
  repas_restants: number | null;
  montant_facture: string;
}

export interface Beneficiaire {
  id_beneficiaire: number;
  nom: string;
  prenom: string;
  identifiant_badge: string;
  statut: StatutBeneficiaire;
  id_abonnement: number;
}

export interface BeneficiaireEnvoye {
  id_abonnement: number;
  nom: string;
  prenom: string;
  identifiant_badge: string;
  statut?: StatutBeneficiaire;
}

export interface ConsommationRepas {
  id_consommation: number;
  date_consommation: string;
  quantite: number;
  id_abonnement: number;
  /** `null` en mode `Global` : la consommation est imputée à l'entreprise
   * sans nominatif. */
  id_beneficiaire: number | null;
}

/** Entrée minimale pour peupler le sélecteur d'entreprise à la création. */
export interface ClientEntrepriseAdministration {
  id_client: number;
  raison_sociale: string;
}
