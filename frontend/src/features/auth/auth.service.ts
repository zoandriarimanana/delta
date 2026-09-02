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

const MESSAGE_INSCRIPTION_PAR_DEFAUT =
  'L’inscription a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus d'une inscription, ou retombe sur un générique.
 *
 * Les refus **409** portent une information que le visiteur peut utiliser :
 * « cette adresse est déjà utilisée », « ce numéro d'identification fiscale est
 * déjà enregistré ». Les remplacer par un message générique ferait perdre
 * exactement ce qui permet de corriger — même traitement que le « stock
 * insuffisant » du tunnel de commande et les refus de réservation.
 *
 * Contrairement à la connexion, il n'y a **rien à protéger** ici : dire qu'une
 * adresse est prise est inévitable, puisque c'est la raison du refus. C'est le
 * revers assumé de l'unicité — et c'est pourquoi le message de *connexion*
 * reste uniforme, lui.
 *
 * Une liste dans `detail` — erreur de validation de schema — retombe sur le
 * message générique, pour ne pas afficher de JSON.
 */
export function messageDInscription(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' && detail.length > 0
    ? detail
    : MESSAGE_INSCRIPTION_PAR_DEFAUT;
}
