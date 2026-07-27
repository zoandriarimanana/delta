/**
 * Stockage du jeton d'accès.
 *
 * Isolé du client HTTP pour deux raisons : le module d'authentification doit
 * pouvoir écrire le jeton après connexion sans importer l'instance axios, et
 * changer de support de stockage (sessionStorage, cookie) ne doit toucher que
 * ce fichier.
 *
 * Choix assumé : `localStorage`. Le jeton est donc lisible par tout script de
 * la page — voir la note de sécurité dans `docs/architecture.md`.
 */

const CLE_JETON = 'delta.access_token';

export function lireJeton(): string | null {
  return localStorage.getItem(CLE_JETON);
}

export function enregistrerJeton(jeton: string): void {
  localStorage.setItem(CLE_JETON, jeton);
}

export function effacerJeton(): void {
  localStorage.removeItem(CLE_JETON);
}
