/** Règles d'affichage du module d'authentification — fonctions pures. */

const MESSAGE_PAR_DEFAUT = 'La connexion a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un message générique.
 *
 * Le serveur répond volontairement le **même** message à tout refus —
 * identifiant inconnu, mot de passe faux, compte sans connexion, compte
 * archivé. Le reprendre tel quel ne divulgue donc rien : c'est précisément ce
 * que l'uniformité du message garantit.
 *
 * Une erreur de validation de schema met en revanche une **liste** dans
 * `detail` ; la rendre telle quelle afficherait du JSON. Même traitement que
 * dans le module réservation.
 */
export function messageDeRefus(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : MESSAGE_PAR_DEFAUT;
}
