/**
 * Types du module d'authentification, relevés du schéma OpenAPI.
 *
 * Le jeton porte une revendication `type` valant `client` ou `personnel`
 * (cf. `docs/architecture.md`, « Deux populations, deux jetons »). Elle n'est
 * pas lue depuis le jeton côté frontend — on ne décode pas un JWT pour se fier
 * à son contenu — mais déduite de l'endpoint interrogé, qui est le seul fait
 * dont le client soit sûr.
 */

/** Réponse de `/auth/connexion` et `/auth/personnel/connexion`. */
export interface Jeton {
  access_token: string;
  token_type: string;
}

/** Identifiants de connexion, communs aux deux populations. */
export interface Identifiants {
  email: string;
  mot_de_passe: string;
}

/**
 * Champs de compte, communs aux deux sous-types.
 *
 * `email` et `mot_de_passe` vivent sur `CLIENT` : ils ne dépendent pas du fait
 * qu'on s'inscrive comme particulier ou comme entreprise. Seul `identite`
 * change — d'où cette base partagée plutôt que deux charges utiles écrites deux
 * fois (cf. `docs/mld.md`, class table inheritance).
 */
interface CompteEnvoye {
  email: string;
  /** Huit caractères minimum, et 72 **octets** au plus — la limite de bcrypt. */
  mot_de_passe: string;
  telephone?: string;
  adresse?: string;
}

/** Identité d'un client particulier. */
export interface IdentiteParticulier {
  nom: string;
  prenom: string;
  /** Facultative : format `AAAA-MM-JJ`. */
  date_naissance?: string;
}

/** Identité d'un client entreprise. */
export interface IdentiteEntreprise {
  raison_sociale: string;
  /** Unique en base : deux entreprises ne peuvent pas le partager. */
  numero_id_fiscal: string;
  secteur_activite?: string;
  nom_contact_referent?: string;
}

/**
 * Charges utiles d'inscription.
 *
 * L'identité est un **objet imbriqué** et non des champs à plat : envoyer
 * `nom` et `prenom` au premier niveau donne un 422 `missing … body.identite`.
 * Vérifié contre l'API, pas déduit du schéma.
 */
export interface InscriptionParticulier extends CompteEnvoye {
  identite: IdentiteParticulier;
}

export interface InscriptionEntreprise extends CompteEnvoye {
  identite: IdentiteEntreprise;
}

/**
 * Client renvoyé par l'inscription.
 *
 * **Aucun jeton** : l'API répond le client créé, et la session s'ouvre ensuite
 * par `/auth/connexion`. C'est délibéré — un seul chemin d'émission de jeton à
 * auditer (cf. `docs/architecture.md`).
 */
export interface ClientInscrit {
  id_client: number;
  type_client: 'Particulier' | 'Entreprise';
  email: string;
}
