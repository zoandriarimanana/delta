/**
 * Réservations d'une salle ou d'un logement, pour sa fiche d'administration.
 *
 * Composant du module `reservation`, que les fiches salle et logement
 * **montent** sans appeler elles-mêmes l'API de réservation — même règle que
 * « Réserver n'est pas consulter » (`docs/architecture.md`).
 *
 * Lit `GET /reservations/administration`, qui n'a pas de filtre : le tri par
 * bien se fait ici, comme le filtre de l'écran des réservations (dette 10.3).
 * Les réservations à venir d'abord, puis les passées.
 */

import { Link } from 'react-router';

import Badge, { type VarianteBadge } from '@/components/ui/Badge';
import { formaterDate } from '@/features/commande/commande.service';
import {
  CLASSES_LIGNE_CLIQUABLE,
  useNavigationAuClic,
} from '@/lib/useNavigationAuClic';

import { useReservationsAdministration } from '../reservation.administration';
import { libelleStatut } from '../reservation.service';
import type { Reservation, StatutReservation } from '../reservation.types';

export type BienReserve = { salle: number } | { logement: number };

const VARIANTES: Record<StatutReservation, VarianteBadge> = {
  En_attente: 'attente',
  Confirmee: 'positif',
  Honoree: 'neutre',
  Annulee: 'negatif',
};

function concerne(reservation: Reservation, bien: BienReserve): boolean {
  return 'salle' in bien
    ? reservation.id_salle === bien.salle
    : reservation.id_logement === bien.logement;
}

interface Proprietes {
  bien: BienReserve;
}

export default function ReservationsDuBien({ bien }: Proprietes) {
  const donnees = useReservationsAdministration();
  const naviguerAuClic = useNavigationAuClic();
  const maintenant = Date.now();

  const reservations = donnees.reservations
    .filter((r) => concerne(r, bien))
    .sort((a, b) => {
      const aVenir = (r: Reservation) => new Date(r.date_fin).getTime() >= maintenant;
      if (aVenir(a) !== aVenir(b)) return aVenir(a) ? -1 : 1;
      return aVenir(a)
        ? new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
        : new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime();
    });
  const aVenir = reservations.filter(
    (r) => new Date(r.date_fin).getTime() >= maintenant && r.statut !== 'Annulee'
  ).length;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-gris-700">Réservations</h2>
      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-2 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {donnees.erreur}
        </p>
      )}
      {donnees.chargement ? (
        <p role="status" className="mt-2 text-sm text-gris-500">
          Chargement…
        </p>
      ) : reservations.length === 0 ? (
        <p className="mt-2 text-sm text-gris-500">Aucune réservation pour le moment.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-gris-600">
            {reservations.length} réservation(s), dont {aVenir} à venir.
          </p>
          <table className="mt-3 w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2 text-sm font-medium text-gris-600">N°</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Début</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Fin</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">
                  Personnes
                </th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => {
                const fiche = `/personnel/reservations/${reservation.id_reservation}`;
                return (
                  <tr
                    key={reservation.id_reservation}
                    onClick={naviguerAuClic(fiche)}
                    className={`border-t border-gris-100 ${CLASSES_LIGNE_CLIQUABLE}`}
                  >
                    <td className="px-3 py-2 text-sm">
                      <Link to={fiche} className="text-gris-700 hover:underline">
                        #{reservation.id_reservation}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gris-700">
                      {formaterDate(reservation.date_debut)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gris-700">
                      {formaterDate(reservation.date_fin)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gris-700">
                      {reservation.nombre_personnes}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variante={VARIANTES[reservation.statut]}>
                        {libelleStatut(reservation.statut)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
