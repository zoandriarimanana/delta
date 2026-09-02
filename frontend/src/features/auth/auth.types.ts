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
