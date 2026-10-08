/**
 * Une réservation dans « Mes réservations » : ce qui est réservé, quand, pour
 * combien, son statut — et ce que le client peut en faire.
 *
 * L'annulation demande une **confirmation** dans la carte elle-même : un clic
 * isolé ne doit pas libérer une place ou un créneau par mégarde.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  BedDouble,
  CalendarDays,
  Star,
  Users,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import FormulaireAvis from '@/features/avis/components/FormulaireAvis';
import { formaterDate } from '@/features/commande/commande.service';
import { useTextes } from '@/lib/langue';

import { TEXTES_RESERVATION } from '../reservation.textes';
import type { CibleResolue } from '../reservation.cibles';
import {
  imageCible,
  libelleCible,
  libelleStatut,
  libelleType,
  peutAnnulerClient,
  varianteStatut,
} from '../reservation.service';
import type { Reservation } from '../reservation.types';

interface Proprietes {
  reservation: Reservation;
  cible: CibleResolue | undefined;
  maintenant: Date;
  surAnnulation: (idReservation: number) => Promise<string | null>;
}

export default function CarteReservationClient({
  reservation,
  cible,
  maintenant,
  surAnnulation,
}: Proprietes) {
  const t = useTextes(TEXTES_RESERVATION);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avisOuvert, setAvisOuvert] = useState(false);

  const nom = cible?.nom ?? libelleCible(reservation);
  const image = cible?.image ?? imageCible(reservation);
  const annulable = peutAnnulerClient(reservation, maintenant);
  // Le serveur refuserait de toute façon en 409 un avis sur une réservation
  // non honorée (cf. `docs/mld.md`) : le bouton n'apparaît qu'à ce moment.
  const proposerAvis = reservation.statut === 'Honoree';

  async function annuler() {
    setEnvoi(true);
    setErreur(null);
    const message = await surAnnulation(reservation.id_reservation);
    setEnvoi(false);
    if (message !== null) {
      setErreur(message);
    } else {
      setConfirmer(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-gris-200 bg-surface p-5 shadow-sm sm:flex-row">
      <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-gris-200 sm:h-24 sm:w-32">
        {image !== null ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-primaire">
            <UtensilsCrossed size={32} aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{libelleType(reservation.type_reservation)}</Badge>
          <Badge variante={varianteStatut(reservation.statut)}>
            {libelleStatut(reservation.statut, reservation.type_reservation)}
          </Badge>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-gris-700">
          {cible?.lien != null ? (
            <Link to={cible.lien} className="no-underline hover:text-primaire">
              {nom}
            </Link>
          ) : (
            nom
          )}
        </h2>
        <p className="text-xs text-gris-500">
          {t.reservationNumero(reservation.id_reservation)}
        </p>

        <ul className="mt-3 space-y-1.5 text-sm text-gris-600">
          <li className="flex items-start gap-2">
            <CalendarDays
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-primaire"
            />
            <span>
              {t.du}{' '}
              <time dateTime={reservation.date_debut}>
                {formaterDate(reservation.date_debut)}
              </time>{' '}
              {t.au}{' '}
              <time dateTime={reservation.date_fin}>
                {formaterDate(reservation.date_fin)}
              </time>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Users size={16} aria-hidden className="shrink-0 text-primaire" />
            {t.personnes(reservation.nombre_personnes)}
          </li>
          {reservation.avec_hebergement && (
            <li className="flex items-center gap-2">
              <BedDouble size={16} aria-hidden className="shrink-0 text-primaire" />
              {/* Le drapeau dit un souhait ; seul le lien prouve qu'une chambre
                  est attribuée (cf. `docs/mld.md`). */}
              {reservation.id_reservation_hebergement !== null
                ? t.hebergementAttribue
                : t.hebergementDemande}
            </li>
          )}
        </ul>

        {erreur !== null && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {erreur}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {annulable && !confirmer && (
            <button
              type="button"
              onClick={() => setConfirmer(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gris-300 px-4 py-1.5 text-sm font-medium text-gris-700 transition-colors hover:border-primaire hover:text-primaire"
            >
              <XCircle size={16} aria-hidden />
              {t.annulerReservation}
            </button>
          )}
          {confirmer && (
            <div
              role="group"
              aria-label={t.confirmerAnnulation}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm"
            >
              <span className="text-gris-700">
                {reservation.type_reservation === 'Formation'
                  ? t.liberePlace
                  : t.libereCreneau}
              </span>
              <button
                type="button"
                disabled={envoi}
                onClick={() => void annuler()}
                className="rounded-full bg-danger px-3 py-1 font-semibold text-sur-couleur disabled:opacity-60"
              >
                {envoi ? t.annulation : t.confirmerAnnulation}
              </button>
              <button
                type="button"
                disabled={envoi}
                onClick={() => setConfirmer(false)}
                className="rounded-full px-3 py-1 font-medium text-gris-600 hover:bg-surface"
              >
                {t.garder}
              </button>
            </div>
          )}
          {proposerAvis && !avisOuvert && (
            <button
              type="button"
              onClick={() => setAvisOuvert(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primaire hover:underline"
            >
              <Star size={14} aria-hidden />
              {t.deposerAvis}
            </button>
          )}
        </div>
        {avisOuvert && (
          <FormulaireAvis cible="Service" idCible={reservation.id_reservation} />
        )}
      </div>
    </li>
  );
}
