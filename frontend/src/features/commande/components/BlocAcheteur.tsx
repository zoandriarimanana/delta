/**
 * Désignation de l'acheteur d'une commande saisie par un salarié.
 *
 * **Deux chemins mutuellement exclusifs**, miroir du schema serveur : une
 * réservation de table, ou une identité invitée. Jamais les deux — le serveur
 * refuse en 422, et l'écran ne doit pas laisser composer une saisie qu'il
 * refusera.
 *
 * **Aucun champ « identifiant client ».** Sur le chemin réservation, l'acheteur
 * est déduit de `reservation.id_client` par le serveur ; le salarié ne le
 * désigne pas. Offrir ce champ inviterait à commander au nom d'autrui, et
 * romprait le principe tenu depuis le Sprint 2 : aucune identité ne vient de la
 * requête.
 */

import type { CheminAcheteur } from '../commande.types';

interface Proprietes {
  chemin: CheminAcheteur;
  surChangementChemin: (chemin: CheminAcheteur) => void;
  reservation: string;
  surChangementReservation: (valeur: string) => void;
  nom: string;
  surChangementNom: (valeur: string) => void;
  contact: string;
  surChangementContact: (valeur: string) => void;
}

export default function BlocAcheteur({
  chemin,
  surChangementChemin,
  reservation,
  surChangementReservation,
  nom,
  surChangementNom,
  contact,
  surChangementContact,
}: Proprietes) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-900">Acheteur</legend>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          name="chemin_acheteur"
          checked={chemin === 'reservation'}
          onChange={() => surChangementChemin('reservation')}
        />
        Sur une réservation de table
      </label>

      {chemin === 'reservation' && (
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Numéro de réservation
          <input
            type="number"
            min={1}
            value={reservation}
            onChange={(evenement) => surChangementReservation(evenement.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
          <span className="text-xs text-slate-500">
            Le client est déduit de la réservation.
          </span>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          name="chemin_acheteur"
          checked={chemin === 'invite'}
          onChange={() => surChangementChemin('invite')}
        />
        Sans compte
      </label>

      {chemin === 'invite' && (
        <>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Nom de l’acheteur
            <input
              type="text"
              value={nom}
              onChange={(evenement) => surChangementNom(evenement.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Téléphone ou e-mail
            <input
              type="text"
              value={contact}
              onChange={(evenement) => surChangementContact(evenement.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </>
      )}
    </fieldset>
  );
}
