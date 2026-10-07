/**
 * Une session dans la liste d'une formation.
 *
 * Affiche le formateur quand il est affecté — nom, prénom et spécialité, tels
 * que `FormateurPublic` les porte. Ni e-mail ni téléphone : le serveur ne les
 * envoie pas, et le type ne les déclare pas non plus.
 */

import { CalendarDays, UserRound, Users } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import { formaterDate } from '@/features/commande/commande.service';
import FormulaireReservation from '@/features/reservation/components/FormulaireReservation';

import {
  estReservable,
  explicationSession,
  libelleEtatSession,
  nomFormateur,
  varianteEtatSession,
} from '../formation.service';
import type { SessionFormation } from '../formation.types';

interface Proprietes {
  session: SessionFormation;
  proposeHebergement: boolean;
}

export default function CarteSession({ session, proposeHebergement }: Proprietes) {
  const reservable = estReservable(session);

  return (
    <li
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        reservable ? 'border-succes/40' : 'border-gris-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-gris-700">
          <CalendarDays size={18} aria-hidden className="text-primaire" />
          <span>
            Du{' '}
            <time dateTime={session.date_debut}>
              {formaterDate(session.date_debut)}
            </time>{' '}
            au <time dateTime={session.date_fin}>{formaterDate(session.date_fin)}</time>
          </span>
        </p>
        <Badge variante={varianteEtatSession(session)}>
          {libelleEtatSession(session)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gris-600">
        <p className="flex items-center gap-1.5">
          <Users size={16} aria-hidden />
          {session.places_restantes} place(s) restante(s)
        </p>
        {session.formateur !== null && (
          <p className="flex items-center gap-1.5">
            <UserRound size={16} aria-hidden />
            Animée par {nomFormateur(session.formateur)}
            {session.formateur.specialite !== null && (
              <> — {session.formateur.specialite}</>
            )}
          </p>
        )}
      </div>

      {/* Une session complète reste visible : le client doit pouvoir constater
          qu'elle existe et attendre la suivante. Elle n'est simplement pas
          réservable, et le dit — en détail. */}
      <p className="mt-3 text-sm leading-relaxed text-gris-500">
        {explicationSession(session)}
      </p>

      {reservable && (
        <FormulaireReservation
          idSession={session.id_session}
          dateDebut={session.date_debut}
          dateFin={session.date_fin}
          placesRestantes={session.places_restantes}
          proposeHebergement={proposeHebergement}
        />
      )}
    </li>
  );
}
