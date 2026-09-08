/**
 * Administration des réservations, les 4 types confondus.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée
 * côté serveur.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, comme
 * `AdministrationPersonnelPage`. **Une seule page, actions en ligne** — pas
 * de fiche séparée : les deux actions (`Marquer honorée`, `Annuler`) sont de
 * simples transitions de statut, pas des écritures qui justifient un écran
 * dédié.
 *
 * Le filtre type/statut est **côté client** : `GET
 * /reservations/administration` ne porte aucun paramètre de filtre
 * (cf. `reservation.api.ts`).
 */

import { useMemo, useState } from 'react';

import Bouton from '@/components/ui/Bouton';
import { formaterDate } from '@/features/commande/commande.service';

import {
  useActionsReservationAdministration,
  useReservationsAdministration,
} from '../reservation.administration';
import { libelleCible, libelleStatut } from '../reservation.service';
import type {
  Reservation,
  StatutReservation,
  TypeReservation,
} from '../reservation.types';

const TYPES: TypeReservation[] = ['Formation', 'Salle', 'Logement', 'Table'];
const STATUTS: StatutReservation[] = ['En_attente', 'Confirmee', 'Honoree', 'Annulee'];

export default function AdministrationReservationsPage() {
  const donnees = useReservationsAdministration();
  const actions = useActionsReservationAdministration(donnees.recharger);
  const [filtreType, setFiltreType] = useState<TypeReservation | ''>('');
  const [filtreStatut, setFiltreStatut] = useState<StatutReservation | ''>('');

  const reservationsFiltrees = useMemo(
    () =>
      donnees.reservations.filter(
        (r) =>
          (filtreType === '' || r.type_reservation === filtreType) &&
          (filtreStatut === '' || r.statut === filtreStatut)
      ),
    [donnees.reservations, filtreType, filtreStatut]
  );

  return (
    <section>
      <h1 className="text-2xl font-semibold text-warm-gray-700">
        Administration des réservations
      </h1>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-warm-gray-700">
          Type
          <select
            value={filtreType}
            onChange={(e) => setFiltreType(e.target.value as TypeReservation | '')}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            <option value="">Tous</option>
            {TYPES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {valeur}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-warm-gray-700">
          Statut
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as StatutReservation | '')}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            <option value="">Tous</option>
            {STATUTS.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleStatut(valeur)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {donnees.erreur}
        </p>
      )}

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {actions.erreur}
        </p>
      )}

      {donnees.chargement && (
        <p role="status" className="mt-6 text-warm-gray-500">
          Chargement…
        </p>
      )}

      {!donnees.chargement && reservationsFiltrees.length === 0 && (
        <p className="mt-6 text-warm-gray-600">Aucune réservation à afficher.</p>
      )}

      {reservationsFiltrees.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="border-b border-warm-gray-200 text-left">
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Client
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Type
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Cible
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Début
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Statut
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-gray-200">
              {reservationsFiltrees.map((reservation) => (
                <LigneReservation
                  key={reservation.id_reservation}
                  reservation={reservation}
                  enCours={actions.idEnCours === reservation.id_reservation}
                  marquerHonoree={() =>
                    void actions.marquerHonoree(reservation.id_reservation)
                  }
                  annuler={() => void actions.annuler(reservation.id_reservation)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LigneReservation({
  reservation,
  enCours,
  marquerHonoree,
  annuler,
}: {
  reservation: Reservation;
  enCours: boolean;
  marquerHonoree: () => void;
  annuler: () => void;
}) {
  // Une réservation annulée est un état terminal : aucune des deux actions
  // ne s'applique (le serveur les refuserait en 409). Honorée peut encore
  // être annulée — seule sa propre transition redondante n'a plus de sens.
  const peutHonorer =
    reservation.statut !== 'Honoree' && reservation.statut !== 'Annulee';
  const peutAnnuler = reservation.statut !== 'Annulee';

  return (
    <tr>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        Client n° {reservation.id_client}
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        {reservation.type_reservation}
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        {libelleCible(reservation)}
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-600">
        {formaterDate(reservation.date_debut)}
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        {libelleStatut(reservation.statut, reservation.type_reservation)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          {peutHonorer && (
            <Bouton variante="secondaire" onClick={marquerHonoree} disabled={enCours}>
              Marquer honorée
            </Bouton>
          )}
          {peutAnnuler && (
            <Bouton variante="secondaire" onClick={annuler} disabled={enCours}>
              Annuler
            </Bouton>
          )}
        </div>
      </td>
    </tr>
  );
}
