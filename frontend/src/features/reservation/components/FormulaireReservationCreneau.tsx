/**
 * Formulaire de réservation d'un **créneau** sur un bien : salle ou logement.
 *
 * Distinct de `FormulaireReservation`, qui sert les sessions de formation. Les
 * deux partagent le hook `useValidationReservation` — donc le traitement des
 * refus — mais rien de leur saisie : une session impose ses dates et propose
 * l'hébergement, un bien se réserve sur un créneau choisi par le client. Les
 * fondre aurait produit un composant dont la moitié des champs seraient
 * inertes selon le cas.
 *
 * Vit dans `features/reservation/` et non dans `salle/` ou `logement/` : c'est
 * une écriture sur `RESERVATION`, et un catalogue n'appelle jamais l'API de
 * réservation (cf. la table « modules ↔ tables » de `docs/architecture.md`).
 */

import { useState } from 'react';
import { Link } from 'react-router';

import { useEstConnecte } from '@/lib/useEstConnecte';

import { useValidationReservation } from '../reservation.hooks';
import type { ReservationEnvoyee } from '../reservation.types';

interface Proprietes {
  /** Détermine le `type_reservation` envoyé et la colonne cible renseignée. */
  cible: 'Salle' | 'Logement';
  idCible: number;
  /** Capacité du bien — borne l'affichage, le serveur arbitre en 422. */
  capacite: number;
  /**
   * Faux pour un logement en maintenance ou hors service. Le serveur refuserait
   * de toute façon ; ne pas afficher le formulaire évite au client de découvrir
   * le refus après coup.
   */
  reservable?: boolean;
}

/**
 * Convertit la valeur d'un `datetime-local` en instant ISO UTC.
 *
 * `datetime-local` rend une heure **sans fuseau** (« 2026-09-01T09:00 ») ; la
 * transmettre telle quelle laisserait le serveur l'interpréter comme UTC, et le
 * créneau se décalerait de l'offset local. `Date` l'interprète dans le fuseau
 * du navigateur, ce qui est bien ce que le client a saisi.
 */
function versInstant(valeurLocale: string): string {
  return new Date(valeurLocale).toISOString();
}

function charge(
  cible: 'Salle' | 'Logement',
  idCible: number,
  debut: string,
  fin: string,
  nombrePersonnes: number
): ReservationEnvoyee {
  const commun = {
    date_debut: versInstant(debut),
    date_fin: versInstant(fin),
    nombre_personnes: nombrePersonnes,
  };
  // L'union discriminée interdit de renseigner `id_logement` sur une
  // réservation de salle : l'incohérence est refusée à la compilation, pas
  // seulement par le 422 du serveur.
  return cible === 'Salle'
    ? { ...commun, type_reservation: 'Salle', id_salle: idCible }
    : { ...commun, type_reservation: 'Logement', id_logement: idCible };
}

export default function FormulaireReservationCreneau({
  cible,
  idCible,
  capacite,
  reservable = true,
}: Proprietes) {
  const connecte = useEstConnecte();
  const { reserver, envoi, erreur, reussite } = useValidationReservation();
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [nombrePersonnes, setNombrePersonnes] = useState(1);

  if (!reservable) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        Ce logement n’est pas réservable pour le moment.
      </p>
    );
  }

  // Un visiteur non connecté n'émet aucun appel : il recevrait un 401, qui
  // effacerait le jeton et déclencherait une redirection — un effet de bord
  // absurde pour quelqu'un qui n'était simplement pas connecté.
  if (!connecte) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        <Link to="/connexion" className="text-slate-900 underline">
          Connectez-vous
        </Link>{' '}
        pour réserver.
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
        void reserver(charge(cible, idCible, debut, fin, nombrePersonnes));
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Début
        <input
          type="datetime-local"
          required
          value={debut}
          onChange={(evenement) => setDebut(evenement.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Fin
        <input
          type="datetime-local"
          required
          // Borne d'affichage seulement : le serveur refuse un intervalle vide
          // ou inversé, et c'est lui qui fait foi.
          min={debut || undefined}
          value={fin}
          onChange={(evenement) => setFin(evenement.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        Nombre de personnes
        <input
          type="number"
          min={1}
          // Borné à la capacité du bien. Ce n'est pas la garantie : le service
          // la vérifie et refuse en 422 (cf. `docs/architecture.md`).
          max={capacite}
          value={nombrePersonnes}
          onChange={(evenement) =>
            setNombrePersonnes(Math.max(1, Number(evenement.target.value) || 1))
          }
          className="w-20 rounded border border-slate-300 px-2 py-1"
        />
      </label>

      {erreur !== null && (
        // Le message du serveur est repris tel quel : « ce créneau chevauche
        // une réservation existante » dit au client quoi corriger, un message
        // générique non. Même traitement que le 409 « session complète ».
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
