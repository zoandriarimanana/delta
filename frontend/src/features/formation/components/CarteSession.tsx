/**
 * Une session dans la liste d'une formation.
 *
 * Affiche le formateur quand il est affecté — nom, prénom et spécialité, tels
 * que `FormateurPublic` les porte. Ni e-mail ni téléphone : le serveur ne les
 * envoie pas, et le type ne les déclare pas non plus.
 */

import { formaterDate } from '@/features/commande/commande.service';
import FormulaireReservation from '@/features/reservation/components/FormulaireReservation';

import { estReservable, nomFormateur, raisonIndisponible } from '../formation.service';
import type { SessionFormation } from '../formation.types';

interface Proprietes {
  session: SessionFormation;
  proposeHebergement: boolean;
}

export default function CarteSession({ session, proposeHebergement }: Proprietes) {
  const indisponible = raisonIndisponible(session);

  return (
    <li className="rounded border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-900">
        <time dateTime={session.date_debut}>{formaterDate(session.date_debut)}</time>
        {' — '}
        <time dateTime={session.date_fin}>{formaterDate(session.date_fin)}</time>
      </p>

      {session.formateur !== null && (
        <p className="mt-1 text-sm text-slate-600">
          Animée par {nomFormateur(session.formateur)}
          {session.formateur.specialite !== null && (
            <> — {session.formateur.specialite}</>
          )}
        </p>
      )}

      <p className="mt-1 text-sm text-slate-500">
        {session.places_restantes} place(s) restante(s)
      </p>

      {/* Une session complète reste visible : le client doit pouvoir constater
          qu'elle existe et attendre la suivante. Elle n'est simplement pas
          réservable, et le dit. */}
      {indisponible !== null ? (
        <p className="mt-3 text-sm text-amber-800">{indisponible}</p>
      ) : (
        estReservable(session) && (
          <FormulaireReservation
            idSession={session.id_session}
            dateDebut={session.date_debut}
            dateFin={session.date_fin}
            placesRestantes={session.places_restantes}
            proposeHebergement={proposeHebergement}
          />
        )
      )}
    </li>
  );
}
