/**
 * Formulaire de réservation d'une session de formation.
 *
 * Vit dans `features/reservation/` et non dans `formation/` : c'est une écriture
 * sur `RESERVATION`, et le catalogue ne doit pas appeler l'API de réservation
 * (cf. la table « modules ↔ tables » de `docs/architecture.md`). La page de
 * formation l'insère sans rien savoir de son implémentation.
 */

import { useState } from 'react';
import { Link } from 'react-router';

import { useEstConnecte } from '@/lib/useEstConnecte';

import { useValidationReservation } from '../reservation.hooks';

interface Proprietes {
  idSession: number;
  dateDebut: string;
  dateFin: string;
  placesRestantes: number;
  /** Vrai si la formation propose l'hébergement — sinon l'option est masquée. */
  proposeHebergement: boolean;
}

export default function FormulaireReservation({
  idSession,
  dateDebut,
  dateFin,
  placesRestantes,
  proposeHebergement,
}: Proprietes) {
  const connecte = useEstConnecte();
  const { reserver, envoi, erreur, reussite } = useValidationReservation();
  const [nombrePersonnes, setNombrePersonnes] = useState(1);
  const [avecHebergement, setAvecHebergement] = useState(false);

  // Un visiteur non connecté n'émet aucun appel : il recevrait un 401, qui
  // effacerait le jeton et déclencherait une redirection — un effet de bord
  // absurde pour quelqu'un qui n'était simplement pas connecté.
  if (!connecte) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        <Link to="/connexion" className="text-slate-900 underline">
          Connectez-vous
        </Link>{' '}
        pour réserver cette session.
      </p>
    );
  }

  if (reussite !== null) {
    return (
      <p role="status" className="mt-3 text-sm text-green-800">
        Réservation enregistrée pour {reussite.nombre_personnes} personne(s).
        Retrouvez-la dans{' '}
        <Link to="/reservations" className="underline">
          vos réservations
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void reserver({
          type_reservation: 'Formation',
          date_debut: `${dateDebut}T00:00:00Z`,
          date_fin: `${dateFin}T00:00:00Z`,
          nombre_personnes: nombrePersonnes,
          id_session: idSession,
          avec_hebergement: avecHebergement,
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Nombre de personnes
        <input
          type="number"
          min={1}
          // Borné à l'affichage sur ce qui reste. Ce n'est pas la garantie :
          // le serveur arbitre par un UPDATE conditionnel et refuse en 409 si
          // la session s'est remplie entre-temps.
          max={placesRestantes}
          value={nombrePersonnes}
          onChange={(evenement) =>
            setNombrePersonnes(Math.max(1, Number(evenement.target.value) || 1))
          }
          className="w-20 rounded border border-slate-300 px-2 py-1"
        />
      </label>

      {/* L'option n'est proposée que si la formation l'offre. Le serveur
          refuserait en 422 de toute façon ; ne pas l'afficher évite au client
          de découvrir le refus après coup. */}
      {proposeHebergement && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={avecHebergement}
            onChange={(evenement) => setAvecHebergement(evenement.target.checked)}
          />
          Je souhaite être hébergé pendant la formation
        </label>
      )}

      {erreur !== null && (
        // Le message du serveur est repris tel quel : « Il ne reste que 2
        // place(s) » dit au client quoi corriger, un message générique non.
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {envoi ? 'Envoi…' : 'Réserver'}
      </button>
    </form>
  );
}
