/**
 * Hooks du module réservation.
 *
 * Le point délicat est le traitement des refus. L'API renvoie deux erreurs
 * **métier** distinctes, qui portent chacune une information que le client peut
 * utiliser :
 *
 * - **409** « Il ne reste que N place(s)… » — la session s'est remplie entre
 *   l'affichage et la validation ;
 * - **422** « La formation « … » ne propose pas d'hébergement. » — l'option
 *   demandée n'existe pas sur cette formation.
 *
 * Les remplacer par un message générique ferait perdre exactement ce qui permet
 * de corriger : combien de places restent, ou quelle option retirer. Même
 * traitement que le « stock insuffisant » du tunnel de commande.
 */

import { useCallback, useState } from 'react';

import { creerReservation } from './reservation.api';
import type { Reservation, ReservationEnvoyee } from './reservation.types';

const MESSAGE_ERREUR_PAR_DEFAUT =
  'La réservation n’a pas pu être enregistrée. Réessayez dans un instant.';

export interface ValidationReservation {
  reserver: (donnees: ReservationEnvoyee) => Promise<Reservation | null>;
  envoi: boolean;
  erreur: string | null;
  reussite: Reservation | null;
  reinitialiser: () => void;
}

/**
 * Extrait le message métier de l'API, ou retombe sur un message générique.
 *
 * FastAPI place le message dans `detail` pour nos erreurs métier. Une erreur de
 * validation de schema y met en revanche une **liste** d'objets : la rendre
 * telle quelle afficherait du JSON au client, on retombe donc sur le message
 * générique dans ce cas.
 */
function messageDErreur(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' && detail.length > 0
    ? detail
    : MESSAGE_ERREUR_PAR_DEFAUT;
}

/**
 * Valide une réservation et suit l'état de l'envoi.
 *
 * `reussite` porte la réservation créée, pour que la page affiche une
 * confirmation sans refaire d'appel.
 */
export function useValidationReservation(): ValidationReservation {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reussite, setReussite] = useState<Reservation | null>(null);

  const reserver = useCallback(
    async (donnees: ReservationEnvoyee): Promise<Reservation | null> => {
      setEnvoi(true);
      setErreur(null);

      try {
        const reservation = await creerReservation(donnees);
        setReussite(reservation);
        return reservation;
      } catch (erreurAppel) {
        setErreur(messageDErreur(erreurAppel));
        return null;
      } finally {
        setEnvoi(false);
      }
    },
    []
  );

  const reinitialiser = useCallback(() => {
    setErreur(null);
    setReussite(null);
  }, []);

  return { reserver, envoi, erreur, reussite, reinitialiser };
}
