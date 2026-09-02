/**
 * Stockage du jeton d'accès **et de la population qu'il désigne**.
 *
 * Isolé du client HTTP pour deux raisons : le module d'authentification doit
 * pouvoir écrire le jeton après connexion sans importer l'instance axios, et
 * changer de support de stockage (sessionStorage, cookie) ne doit toucher que
 * ce fichier.
 *
 * **Le type ne se sépare jamais du jeton.** `CLIENT` et `PERSONNEL` sont deux
 * tables dont les clés primaires se recouvrent — le client n°5 et le salarié
 * n°5 existent tous les deux —, ce qui a imposé la revendication `type` dans le
 * jeton côté serveur (#23). Ranger les deux au même endroit sans les distinguer
 * rouvrirait côté navigateur la confusion d'identité que le backend a fermée.
 *
 * **Un seul jeton, et non deux coexistants.** Deux clés de stockage
 * permettraient à un salarié d'être simultanément client, mais obligeraient
 * l'intercepteur HTTP à savoir quelle population chaque requête vise — une
 * notion métier dans la couche HTTP, que `docs/architecture.md` lui interdit au
 * même titre que la connaissance du routeur. Le cumul est un confort, la règle
 * d'architecture une contrainte. Se connecter dans une population **remplace**
 * donc la session de l'autre.
 *
 * Choix assumé : `localStorage`. Le jeton est donc lisible par tout script de
 * la page — voir la note de sécurité dans `docs/architecture.md`.
 */

/** Populations pouvant ouvrir une session. Miroir de `TypeSujet` côté serveur. */
export type TypeSujet = 'client' | 'personnel';

const CLE_JETON = 'delta.access_token';
const CLE_TYPE = 'delta.token_type';

const TYPES: readonly TypeSujet[] = ['client', 'personnel'];

function estTypeConnu(valeur: string | null): valeur is TypeSujet {
  return valeur !== null && (TYPES as readonly string[]).includes(valeur);
}

/** Session en cours : le jeton et la population qu'il désigne. */
export interface Session {
  jeton: string;
  type: TypeSujet;
}

/**
 * Retourne la session en cours, ou `null`.
 *
 * Une session dont le **type est absent ou inconnu** est traitée comme
 * inexistante, exactement comme le serveur refuse un jeton sans revendication
 * `type`. Un tel enregistrement ne peut venir que d'une version antérieure à ce
 * cloisonnement, et le lire par défaut comme un jeton client rouvrirait
 * précisément la confusion qu'on ferme. Le coût est une reconnexion — ce qu'une
 * expiration aurait imposé de toute façon.
 */
export function lireSession(): Session | null {
  const jeton = localStorage.getItem(CLE_JETON);
  const type = localStorage.getItem(CLE_TYPE);
  if (jeton === null || !estTypeConnu(type)) {
    return null;
  }
  return { jeton, type };
}

/**
 * Retourne le seul jeton, sans son type.
 *
 * Réservé à l'intercepteur HTTP, qui n'a besoin que de la valeur à poser dans
 * l'en-tête : c'est le serveur qui vérifie la population, et lui donner le type
 * l'inviterait à en tirer des décisions qui ne le regardent pas.
 */
export function lireJeton(): string | null {
  return lireSession()?.jeton ?? null;
}

/** Ouvre une session, en remplaçant celle qui existait éventuellement. */
export function enregistrerSession(jeton: string, type: TypeSujet): void {
  localStorage.setItem(CLE_JETON, jeton);
  localStorage.setItem(CLE_TYPE, type);
}

/**
 * Ferme la session.
 *
 * Efface les **deux** clés : laisser le type derrière produirait un état
 * intermédiaire qui ne correspond à aucune session réelle.
 */
export function effacerJeton(): void {
  localStorage.removeItem(CLE_JETON);
  localStorage.removeItem(CLE_TYPE);
}
