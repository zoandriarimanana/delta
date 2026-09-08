/**
 * Hooks et règles de l'administration des réservations.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible (cf. `produit.administration.ts`, même
 * traitement).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  changerStatutAdministration,
  recupererReservationsAdministration,
} from './reservation.api';
import type { Reservation } from './reservation.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Le **403** est le cas propre à ces écrans : un salarié sans droit voit
 * l'écran (l'authentification de personnel suffit à y accéder par le menu)
 * mais se voit refuser l'écriture. Le **409** dit qu'une réservation déjà
 * annulée ne peut plus changer — repris tel quel, il dit exactement ce qui
 * bloque.
 */
export function messageDAdministration(erreur: unknown): string {
  const reponse = (
    erreur as { response?: { status?: number; data?: { detail?: unknown } } } | null
  )?.response;

  if (reponse?.status === 403) {
    return 'Cette action est réservée aux administrateurs.';
  }

  const detail = reponse?.data?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : MESSAGE_PAR_DEFAUT;
}

export interface ReservationsAdministration {
  reservations: Reservation[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/** Toutes les réservations, les 4 types confondus. */
export function useReservationsAdministration(): ReservationsAdministration {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    recupererReservationsAdministration()
      .then((donnees) => actif && setReservations(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { reservations, chargement, erreur, recharger };
}

export interface ActionsReservationAdministration {
  marquerHonoree: (idReservation: number) => Promise<boolean>;
  annuler: (idReservation: number) => Promise<boolean>;
  /** Réservation dont l'action la plus récente est en cours, pour ne
   * désactiver que le bouton concerné plutôt que toute la liste. */
  idEnCours: number | null;
  erreur: string | null;
}

/**
 * Change le statut d'une réservation, depuis la liste d'administration.
 *
 * `recharger` est appelé après un succès pour refléter le nouveau statut —
 * contrairement à PERSONNEL, `GET /reservations/administration` continue de
 * renvoyer une réservation `Honoree` ou `Annulee` : ce sont des statuts d'un
 * cycle de vie, pas un archivage, la ligne ne disparaît jamais de la liste.
 */
export function useActionsReservationAdministration(
  recharger: () => void
): ActionsReservationAdministration {
  const [idEnCours, setIdEnCours] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const changer = useCallback(
    async (idReservation: number, statut: 'Honoree' | 'Annulee'): Promise<boolean> => {
      setIdEnCours(idReservation);
      setErreur(null);
      try {
        await changerStatutAdministration(idReservation, statut);
        recharger();
        return true;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return false;
      } finally {
        setIdEnCours(null);
      }
    },
    [recharger]
  );

  return {
    marquerHonoree: (id) => changer(id, 'Honoree'),
    annuler: (id) => changer(id, 'Annulee'),
    idEnCours,
    erreur,
  };
}
