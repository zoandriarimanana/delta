/**
 * Réservations du client connecté.
 *
 * L'isolation est garantie côté serveur : le filtre vient du jeton, et la
 * réservation d'un autre répond 404 — jamais 403, qui confirmerait son
 * existence. Aucun identifiant de client n'est envoyé d'ici.
 *
 * **Attend la vérification initiale de session** (T0.10, `useChargementSession`)
 * avant de décider quoi afficher : sans elle, un client réellement connecté
 * verrait, à chaque chargement de page, un message « connectez-vous » suivi
 * d'un chargement tardif de ses réservations — la vérification de session
 * étant asynchrone (`GET /auth/moi`), pas la lecture synchrone d'un jeton en
 * `localStorage` comme avant.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { formaterDate } from '@/features/commande/commande.service';
import FormulaireAvis from '@/features/avis/components/FormulaireAvis';
import { useChargementSession, useEstConnecte } from '@/lib/useEstConnecte';

import { recupererReservations } from '../reservation.api';
import { libelleCible, libelleStatut } from '../reservation.service';
import type { Reservation } from '../reservation.types';

export default function MesReservationsPage() {
  const chargementSession = useChargementSession();
  const connecte = useEstConnecte();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    // Aucune requête avant que la session soit connue, ni si elle ne l'est
    // pas : elle reviendrait en 401, ce qui effacerait la session et
    // déclencherait une redirection pour quelqu'un qui n'était simplement pas
    // connecté.
    if (chargementSession || !connecte) {
      return undefined;
    }
    let actif = true;
    recupererReservations()
      .then((donnees) => actif && setReservations(donnees))
      .catch(() => actif && setErreur('Vos réservations n’ont pas pu être chargées.'));
    return () => {
      actif = false;
    };
  }, [chargementSession, connecte]);

  useEffect(charger, [charger]);

  if (chargementSession) {
    return null;
  }

  if (!connecte) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Mes réservations</h1>
        <p className="mt-2 text-slate-600">
          Connectez-vous pour retrouver vos réservations.
        </p>
        <Link to="/connexion" className="mt-4 inline-block text-slate-900 underline">
          Se connecter
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Mes réservations</h1>

      {erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {erreur}
        </p>
      )}

      {reservations === null && erreur === null && (
        <p role="status" className="mt-4 text-slate-500">
          Chargement…
        </p>
      )}

      {reservations !== null && reservations.length === 0 && (
        <>
          <p className="mt-4 text-slate-600">Vous n’avez aucune réservation.</p>
          <Link to="/formations" className="mt-4 inline-block text-slate-900 underline">
            Parcourir les formations
          </Link>
          <Link
            to="/salles"
            className="mt-4 ml-4 inline-block text-slate-900 underline"
          >
            Parcourir les salles
          </Link>
        </>
      )}

      <ul className="mt-6 space-y-4">
        {(reservations ?? []).map((reservation) => (
          <ReservationAvecAvis
            key={reservation.id_reservation}
            reservation={reservation}
          />
        ))}
      </ul>
    </section>
  );
}

function ReservationAvecAvis({ reservation }: { reservation: Reservation }) {
  const [ouvert, setOuvert] = useState(false);
  // Le serveur refuserait de toute façon en 409 une réservation non honorée
  // (cf. `docs/mld.md`) : ne pas proposer le bouton évite au client de
  // découvrir le refus après avoir rempli le formulaire.
  const proposerAvis = reservation.statut === 'Honoree';

  return (
    <li className="rounded border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">{libelleCible(reservation)}</h2>
      <p className="mt-1 text-xs text-slate-500">
        Réservation n° {reservation.id_reservation}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        <time dateTime={reservation.date_debut}>
          {formaterDate(reservation.date_debut)}
        </time>
        {' — '}
        {reservation.nombre_personnes} personne(s)
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {libelleStatut(reservation.statut, reservation.type_reservation)}
      </p>
      {reservation.avec_hebergement && (
        // Le drapeau dit un souhait, pas une chambre attribuée — la
        // formulation le reflète (cf. `docs/mld.md`).
        <p className="mt-1 text-sm text-slate-500">Hébergement demandé</p>
      )}
      {proposerAvis && !ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="mt-1 text-sm text-slate-900 underline"
        >
          Déposer un avis
        </button>
      )}
      {ouvert && (
        <FormulaireAvis cible="Service" idCible={reservation.id_reservation} />
      )}
    </li>
  );
}
