/**
 * Instance axios unique de l'application.
 *
 * Tout appel HTTP passe par ici. Les fichiers `*.api.ts` des modules
 * (`features/<module>/`) importent cette instance et ne créent jamais la leur :
 * c'est ce qui garantit qu'un seul endroit porte l'URL de base, l'injection du
 * jeton et le traitement des erreurs d'authentification.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { effacerJeton, lireJeton, lireSession, type TypeSujet } from './tokenStorage';

/**
 * Événement émis quand le serveur rejette le jeton. L'application y réagit
 * (redirection vers la page de connexion) sans que ce module ait à connaître
 * le routeur — il n'existe pas encore à ce stade, et il ne doit de toute façon
 * pas être une dépendance de la couche HTTP.
 */
export const EVENEMENT_NON_AUTHENTIFIE = 'delta:non-authentifie';

/**
 * Population dont la session vient d'être rejetée, portée par l'événement.
 *
 * Le jeton est effacé avant l'émission ; sans cette information, l'écouteur ne
 * pourrait plus savoir *qui* a été déconnecté et renverrait un salarié vers la
 * connexion client. La couche HTTP ne décide toujours pas de la navigation —
 * elle rapporte un fait, l'écouteur en tire une route.
 *
 * `null` quand aucune session n'était ouverte : un 401 sur une requête anonyme.
 */
export interface DetailNonAuthentifie {
  type: TypeSujet | null;
}

const urlDeBase = import.meta.env.VITE_API_URL;

if (!urlDeBase) {
  // Échec au démarrage plutôt qu'à la première requête : sans cette garde, axios
  // tomberait sur des URL relatives et produirait des 404 sur le serveur de
  // dev, symptôme trompeur pour une variable d'environnement absente.
  throw new Error(
    'VITE_API_URL est absente. Copier frontend/.env.example en frontend/.env.'
  );
}

export const axiosClient = axios.create({
  baseURL: urlDeBase,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Chemins où un 401 est une réponse métier normale, pas une session expirée.
 *
 * `/auth/personnel/connexion` y figure pour la même raison que
 * `/auth/connexion` : un salarié qui se trompe de mot de passe reçoit « mot de
 * passe faux », pas « session expirée ». Sans cette entrée, l'erreur effacerait
 * la session en cours et déclencherait une redirection — punir une faute de
 * frappe par une déconnexion.
 */
const CHEMINS_PUBLICS = [
  '/auth/connexion',
  '/auth/personnel/connexion',
  '/auth/inscription',
];

function estCheminPublic(url: string | undefined): boolean {
  return url !== undefined && CHEMINS_PUBLICS.some((chemin) => url.includes(chemin));
}

// --- Requête : injection du jeton -------------------------------------------

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const jeton = lireJeton();
  if (jeton) {
    config.headers.set('Authorization', `Bearer ${jeton}`);
  }
  return config;
});

// --- Réponse : traitement du 401 --------------------------------------------

axiosClient.interceptors.response.use(
  (reponse) => reponse,
  (erreur: AxiosError) => {
    const statut = erreur.response?.status;

    // Un 401 sur /auth/connexion signifie « mot de passe faux », pas « session
    // expirée » : effacer le jeton et rediriger ferait perdre la session d'un
    // utilisateur déjà connecté qui se trompe en saisissant un second compte.
    if (statut === 401 && !estCheminPublic(erreur.config?.url)) {
      // Lu **avant** l'effacement : ensuite, plus rien ne dit quelle population
      // vient d'être déconnectée.
      const type = lireSession()?.type ?? null;
      effacerJeton();
      window.dispatchEvent(
        new CustomEvent<DetailNonAuthentifie>(EVENEMENT_NON_AUTHENTIFIE, {
          detail: { type },
        })
      );
    }

    // L'erreur continue de remonter : le module appelant reste libre d'afficher
    // son propre message. L'intercepteur nettoie, il ne décide pas à sa place.
    return Promise.reject(erreur);
  }
);
