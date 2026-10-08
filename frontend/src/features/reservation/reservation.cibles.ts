/**
 * Noms et liens des cibles des réservations du client — salle, logement,
 * formation.
 *
 * La réservation ne porte qu'un identifiant (`id_salle`, `id_session`…) :
 * l'afficher tel quel donnait « Salle n° 3 ». On résout donc les noms, avec
 * **une requête par cible distincte**, jamais une par ligne — deux
 * réservations de la même salle ne la chargent qu'une fois, et les listes
 * publiques des salles et logements couvrent toutes les lignes d'un coup.
 *
 * Fichier à part des `hooks` : il consomme les API de trois autres modules,
 * et cette dépendance mérite d'être lisible d'un coup d'œil (même esprit que
 * `DetailCible`).
 */

import { useEffect, useState } from 'react';

import {
  recupererFormation,
  recupererSession,
} from '@/features/formation/formation.api';
import { recupererLogements } from '@/features/logement/logement.api';
import { recupererSalles } from '@/features/salle/salle.api';
import { imagePour } from '@/lib/images';
import { textesCourants } from '@/lib/langue';

import { TEXTES_RESERVATION } from './reservation.textes';
import type { Reservation } from './reservation.types';

export interface CibleResolue {
  nom: string;
  /** Fiche publique de la cible, `null` si elle n'en a pas (table). */
  lien: string | null;
  image: string | null;
}

/** Clé d'une réservation dans la table des cibles résolues. */
export function cleCible(reservation: Reservation): string {
  return `${reservation.type_reservation}:${
    reservation.id_session ?? reservation.id_salle ?? reservation.id_logement ?? ''
  }`;
}

/**
 * Résout les cibles des réservations données. Ce qui n'a pas pu l'être
 * (cible archivée, réseau) est simplement absent : l'appelant retombe sur
 * `libelleCible`, jamais sur un écran vide.
 */
export function useCiblesResolues(
  reservations: Reservation[] | null
): Map<string, CibleResolue> {
  const [cibles, setCibles] = useState<Map<string, CibleResolue>>(new Map());

  useEffect(() => {
    if (reservations === null || reservations.length === 0) return;
    let actif = true;
    const sessions = [
      ...new Set(
        reservations.map((r) => r.id_session).filter((id): id is number => id !== null)
      ),
    ];
    const avecSalle = reservations.some((r) => r.id_salle !== null);
    const avecLogement = reservations.some((r) => r.id_logement !== null);

    void (async () => {
      const table = new Map<string, CibleResolue>();
      const [salles, logements] = await Promise.all([
        avecSalle ? recupererSalles().catch(() => []) : Promise.resolve([]),
        avecLogement ? recupererLogements().catch(() => []) : Promise.resolve([]),
      ]);
      for (const salle of salles) {
        table.set(`Salle:${salle.id_salle}`, {
          nom: salle.nom,
          lien: `/salles/${salle.id_salle}`,
          image: imagePour('salle', salle.id_salle),
        });
      }
      for (const logement of logements) {
        table.set(`Logement:${logement.id_logement}`, {
          nom: textesCourants(TEXTES_RESERVATION).chambre(logement.type_chambre),
          lien: `/logements/${logement.id_logement}`,
          image: imagePour('logement', logement.id_logement),
        });
      }
      const formations = new Map<number, Promise<string | null>>();
      await Promise.all(
        sessions.map(async (idSession) => {
          try {
            const session = await recupererSession(idSession);
            if (!formations.has(session.id_formation)) {
              formations.set(
                session.id_formation,
                recupererFormation(session.id_formation)
                  .then((f) => f.titre)
                  .catch(() => null)
              );
            }
            const titre = await formations.get(session.id_formation)!;
            if (titre !== null) {
              table.set(`Formation:${idSession}`, {
                nom: titre,
                lien: `/formations/${session.id_formation}`,
                image: imagePour('formation', session.id_formation),
              });
            }
          } catch {
            // Session archivée ou réseau : on retombe sur le libellé générique.
          }
        })
      );
      if (actif) setCibles(table);
    })();

    return () => {
      actif = false;
    };
  }, [reservations]);

  return cibles;
}
