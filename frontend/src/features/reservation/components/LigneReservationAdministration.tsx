/**
 * Une ligne du tableau d'administration des réservations.
 *
 * Ce que l'administrateur doit lire d'un coup d'œil : **quoi** (photo, nom
 * réel de la cible, type), **qui**, **quand**, **où en est-elle** (pastille
 * colorée) et **que puis-je faire** (boutons colorés par intention : vert pour
 * honorer, rouge pour annuler).
 *
 * L'annulation est **irréversible** — une réservation `Annulee` ne change plus
 * de statut (cf. `docs/architecture.md`). Elle passe donc par une
 * confirmation en ligne, plutôt qu'un clic unique à côté d'un bouton vert.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  BedDouble,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  UserRound,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import type { CibleResolue } from '../reservation.cibles';
import {
  imageCible,
  libelleCible,
  libelleStatut,
  libelleType,
  peutAnnuler,
  peutConfirmer,
  peutMarquerHonoree,
  varianteStatut,
} from '../reservation.service';
import type { Reservation, TypeReservation } from '../reservation.types';

/** Date courte, sur une ligne : « 23 sept. 2026, 10:39 ». */
const FORMAT_COURT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function dateCourte(iso: string): string {
  return FORMAT_COURT.format(new Date(iso));
}

const ICONES_TYPE: Record<TypeReservation, typeof Building2> = {
  Formation: GraduationCap,
  Salle: Building2,
  Logement: BedDouble,
  Table: UtensilsCrossed,
};

interface Proprietes {
  reservation: Reservation;
  cible: CibleResolue | undefined;
  enCours: boolean;
  confirmer: () => void;
  marquerHonoree: () => void;
  annuler: () => void;
}

export default function LigneReservationAdministration({
  reservation,
  cible,
  enCours,
  confirmer,
  marquerHonoree,
  annuler,
}: Proprietes) {
  const [confirmation, setConfirmation] = useState(false);
  const image = cible?.image ?? imageCible(reservation);
  const nom = cible?.nom ?? libelleCible(reservation);
  const IconeType = ICONES_TYPE[reservation.type_reservation] ?? Building2;
  const aTraiter = reservation.statut === 'En_attente';

  return (
    <tr
      className={`align-middle transition-colors hover:bg-gris-100/60 ${
        aTraiter ? 'bg-attente/5' : ''
      }`}
    >
      <td
        className={`border-l-4 py-3 pl-3 pr-3 ${
          aTraiter ? 'border-attente' : 'border-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          {image !== null ? (
            <img
              src={image}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primaire/10 text-primaire">
              <IconeType size={22} aria-hidden />
            </span>
          )}
          <div className="min-w-[11rem]">
            <p className="font-medium text-gris-700">{nom}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gris-500">
              <IconeType size={13} aria-hidden />
              {libelleType(reservation.type_reservation)}
              <span className="sr-only"> — </span>
              <span className="ml-1">n° {reservation.id_reservation}</span>
            </p>
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-3 text-sm text-gris-700">
        <UserRound
          size={15}
          aria-hidden
          className="mr-1.5 inline-block align-[-2px] text-gris-400"
        />
        Client n° {reservation.id_client}
      </td>

      <td className="whitespace-nowrap px-3 py-3 text-sm">
        <p className="text-gris-700">{dateCourte(reservation.date_debut)}</p>
        <p className="text-xs text-gris-500">→ {dateCourte(reservation.date_fin)}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gris-500">
          <Users size={12} aria-hidden />
          {reservation.nombre_personnes} pers.
        </p>
      </td>

      <td className="px-3 py-3">
        <Badge variante={varianteStatut(reservation.statut)}>
          {libelleStatut(reservation.statut)}
        </Badge>
      </td>

      <td className="px-3 py-3">
        <div className="ml-auto flex max-w-[22rem] flex-wrap items-center justify-end gap-2">
          {confirmation ? (
            <>
              <span className="w-full text-right text-xs font-medium text-danger">
                Annuler cette réservation ?
              </span>
              <Bouton
                variante="danger"
                icone={X}
                onClick={() => {
                  setConfirmation(false);
                  annuler();
                }}
                disabled={enCours}
                className="whitespace-nowrap px-3 py-1.5"
              >
                Confirmer l’annulation
              </Bouton>
              <Bouton
                variante="neutre"
                onClick={() => setConfirmation(false)}
                className="whitespace-nowrap px-3 py-1.5"
              >
                Garder
              </Bouton>
            </>
          ) : (
            <>
              {peutConfirmer(reservation) && (
                <Bouton
                  variante="primaire"
                  icone={CheckCircle2}
                  onClick={confirmer}
                  disabled={enCours}
                  className="whitespace-nowrap px-3 py-1.5"
                >
                  Confirmer
                </Bouton>
              )}
              {peutMarquerHonoree(reservation) && (
                <Bouton
                  variante="valider"
                  icone={Check}
                  onClick={marquerHonoree}
                  disabled={enCours}
                  className="whitespace-nowrap px-3 py-1.5"
                >
                  Marquer honorée
                </Bouton>
              )}
              {peutAnnuler(reservation) && (
                <Bouton
                  variante="danger-contour"
                  icone={X}
                  onClick={() => setConfirmation(true)}
                  disabled={enCours}
                  className="whitespace-nowrap px-3 py-1.5"
                >
                  Annuler
                </Bouton>
              )}
            </>
          )}
          <Link
            to={`/personnel/reservations/${reservation.id_reservation}`}
            className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primaire no-underline hover:bg-primaire/10"
          >
            Détail
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      </td>
    </tr>
  );
}
