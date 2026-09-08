/**
 * Instance axios unique de l'application.
 *
 * Tout appel HTTP passe par ici. Les fichiers `*.api.ts` des modules
 * (`features/<module>/`) importent cette instance et ne créent jamais la leur :
 * c'est ce qui garantit qu'un seul endroit porte l'URL de base, le double-submit
 * anti-CSRF et le traitement des erreurs d'authentification.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import type { TypeSujet } from '@/features/auth/auth.types';

import { effacerSession, lireSession } from './session.store';

/**
 * Événement émis quand le serveur rejette la session. L'application y réagit
 * (redirection vers la page de connexion) sans que ce module ait à connaître
 * le routeur — il n'existe pas encore à ce stade, et il ne doit de toute façon
 * pas être une dépendance de la couche HTTP.
 */
export const EVENEMENT_NON_AUTHENTIFIE = 'delta:non-authentifie';

/**
 * Population dont la session vient d'être rejetée, portée par l'événement.
 *
 * Le magasin de session est effacé avant l'émission ; sans cette information,
 * l'écouteur ne pourrait plus savoir *qui* a été déconnecté et renverrait un
 * salarié vers la connexion client. La couche HTTP ne décide toujours pas de
 * la navigation — elle rapporte un fait, l'écouteur en tire une route.
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
  // Depuis T0.10 : le cookie de session (`httpOnly`, posé par le serveur) ne
  // part sur une requête cross-port (5173 → 8000 en développement) que si le
  // client HTTP le demande explicitement — axios ne l'envoie jamais par
  // défaut sur une requête vers une autre origine.
  withCredentials: true,
});

/**
 * Chemins où un 401 est une réponse métier normale, pas une session expirée.
 *
 * `/auth/personnel/connexion` y figure pour la même raison que
 * `/auth/connexion` : un salarié qui se trompe de mot de passe reçoit « mot de
 * passe faux », pas « session expirée ». Sans cette entrée, l'erreur effacerait
 * la session en cours et déclencherait une redirection — punir une faute de
 * frappe par une déconnexion.
 *
 * `/auth/moi` y figure pour une raison différente (T0.10) : un visiteur jamais
 * connecté reçoit systématiquement 401 à cet appel, au chargement de **chaque**
 * page — c'est le cas normal, pas une session qui expire. Sans cette entrée,
 * tout visiteur non connecté serait redirigé vers `/connexion` dès l'arrivée
 * sur le site.
 */
const CHEMINS_PUBLICS = [
  '/auth/connexion',
  '/auth/personnel/connexion',
  '/auth/inscription',
  '/auth/moi',
];

function estCheminPublic(url: string | undefined): boolean {
  return url !== undefined && CHEMINS_PUBLICS.some((chemin) => url.includes(chemin));
}

/**
 * Méthodes que le middleware anti-CSRF du serveur vérifie — miroir de
 * `core/csrf.py::METHODES_MUTANTES`. Poser l'en-tête sur un `GET` serait sans
 * effet côté serveur, mais y serait quand même inutile à envoyer.
 */
const METHODES_MUTANTES = new Set(['post', 'put', 'patch', 'delete']);

const NOM_COOKIE_CSRF = 'delta_csrf';

/**
 * Lit un cookie par son nom, sans dépendance ajoutée pour un geste aussi
 * court. `delta_csrf` est le seul cookie que ce module a besoin de lire —
 * `delta_session` reste `httpOnly`, donc structurellement invisible ici.
 */
function lireCookie(nom: string): string | null {
  const prefixe = `${nom}=`;
  for (const partie of document.cookie.split('; ')) {
    if (partie.startsWith(prefixe)) {
      return decodeURIComponent(partie.slice(prefixe.length));
    }
  }
  return null;
}

// --- Requête : double-submit anti-CSRF --------------------------------------

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const methode = config.method?.toLowerCase();
  if (methode !== undefined && METHODES_MUTANTES.has(methode)) {
    const csrf = lireCookie(NOM_COOKIE_CSRF);
    if (csrf !== null) {
      config.headers.set('X-CSRF-Token', csrf);
    }
  }
  return config;
});

// --- Réponse : traitement du 401 --------------------------------------------

axiosClient.interceptors.response.use(
  (reponse) => reponse,
  (erreur: AxiosError) => {
    const statut = erreur.response?.status;

    // Un 401 sur /auth/connexion signifie « mot de passe faux », pas « session
    // expirée » : effacer la session et rediriger ferait perdre la session d'un
    // utilisateur déjà connecté qui se trompe en saisissant un second compte.
    if (statut === 401 && !estCheminPublic(erreur.config?.url)) {
      // Lu **avant** l'effacement : ensuite, plus rien ne dit quelle population
      // vient d'être déconnectée.
      const type = lireSession().type;
      effacerSession();
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
