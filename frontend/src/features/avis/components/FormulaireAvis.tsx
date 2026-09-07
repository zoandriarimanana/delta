/**
 * Formulaire de dépôt d'un avis, sur une ligne de commande ou une réservation.
 *
 * Vit dans `features/avis/`, jamais dans `commande/` ou `reservation/` : c'est
 * une écriture sur `AVIS`, entité à part entière (cf. la table
 * « modules ↔ tables » de `docs/architecture.md`). Les modules qui déclenchent
 * l'action — l'historique commandes, l'historique réservations — montent ce
 * composant sans rien savoir de son implémentation, même mécanique que
 * `FormulaireReservationCreneau` pour les catalogues.
 *
 * **Pas de mode édition** : un avis ne se corrige pas, il se remplace (cf.
 * `docs/mld.md`). Ce formulaire ne propose donc que la création.
 */

import { useState } from 'react';

import { useEstConnecte } from '@/lib/useEstConnecte';

import { useDepotAvis } from '../avis.hooks';
import type { AvisEnvoye } from '../avis.types';

interface Proprietes {
  /** Détermine le `type_avis` envoyé et la colonne cible renseignée. */
  cible: 'Produit' | 'Service';
  idCible: number;
}

const NOTES = [1, 2, 3, 4, 5] as const;

function charge(
  cible: 'Produit' | 'Service',
  idCible: number,
  note: number,
  commentaire: string
): AvisEnvoye {
  const commentaireEnvoye = commentaire.trim().length > 0 ? commentaire.trim() : null;
  // L'union discriminée interdit de renseigner `id_reservation` sur un avis
  // « Produit » : l'incohérence est refusée à la compilation, pas seulement
  // par le 422 du serveur — même mécanique que `ReservationEnvoyee`.
  return cible === 'Produit'
    ? { type_avis: 'Produit', note, commentaire: commentaireEnvoye, id_ligne: idCible }
    : {
        type_avis: 'Service',
        note,
        commentaire: commentaireEnvoye,
        id_reservation: idCible,
      };
}

export default function FormulaireAvis({ cible, idCible }: Proprietes) {
  const connecte = useEstConnecte();
  const { deposer, envoi, erreur, reussite } = useDepotAvis();
  const [note, setNote] = useState(5);
  const [commentaire, setCommentaire] = useState('');

  // Un visiteur non connecté n'émet aucun appel : il recevrait un 401, qui
  // effacerait le jeton et déclencherait une redirection — même garde que
  // `FormulaireReservationCreneau`. En pratique ce composant n'apparaît que
  // dans un historique déjà réservé au client connecté, mais la garde reste
  // là où elle protège, pas seulement là où elle sert aujourd'hui.
  if (!connecte) {
    return null;
  }

  if (reussite !== null) {
    return (
      <p role="status" className="mt-2 text-sm text-sage">
        Merci, votre avis a été enregistré.
      </p>
    );
  }

  return (
    <form
      className="mt-2 space-y-2 rounded border border-warm-gray-200 bg-white p-3"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void deposer(charge(cible, idCible, note, commentaire));
      }}
    >
      <label className="flex items-center gap-2 text-sm text-warm-gray-700">
        Note
        <select
          value={note}
          onChange={(evenement) => setNote(Number(evenement.target.value))}
          className="rounded border border-warm-gray-300 px-2 py-1"
        >
          {NOTES.map((valeur) => (
            <option key={valeur} value={valeur}>
              {valeur} / 5
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
        Commentaire (facultatif)
        <textarea
          value={commentaire}
          onChange={(evenement) => setCommentaire(evenement.target.value)}
          rows={2}
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
      </label>

      {erreur !== null && (
        // Repris tel quel : « cette commande n'est pas encore Livree » ou
        // « un avis a déjà été déposé » disent quoi corriger, un message
        // générique non — même traitement que `reservation.hooks.ts`.
        <p
          role="alert"
          className="rounded border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta"
        >
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi}
        className="rounded bg-terracotta px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {envoi ? 'Envoi…' : 'Déposer mon avis'}
      </button>
    </form>
  );
}
