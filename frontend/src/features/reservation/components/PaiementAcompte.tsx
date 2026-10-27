/**
 * Acompte d'une réservation : ce qui reste à payer, avant quand, et le
 * paiement lui-même (13 octobre 2026).
 *
 * Une salle, une chambre ou une formation n'est retenue que si 30 % du prix
 * sont payés dans les 24 h ; au-delà, le serveur annule la réservation. Ce
 * bloc l'annonce et monte le formulaire du module `paiement` — le même que
 * pour une commande, cible « réservation ». Il ne s'affiche que si un
 * acompte est attendu (`acompte_avant`, calculé par le serveur).
 */

import { useState } from 'react';
import { Clock, Lock } from 'lucide-react';

import { formaterDevise } from '@/features/devise/devise.service';
import FormulairePaiement from '@/features/paiement/components/FormulairePaiement';
import { localeCourante, useTextes } from '@/lib/langue';

import { obtenirReservation } from '../reservation.api';
import { TEXTES_RESERVATION } from '../reservation.textes';
import type { Reservation } from '../reservation.types';

interface Proprietes {
  reservation: Reservation;
  /** Juste après la réservation : le formulaire est ouvert d'emblée. */
  ouvertParDefaut?: boolean;
  surPaye?: () => void;
}

export default function PaiementAcompte({
  reservation,
  ouvertParDefaut = false,
  surPaye,
}: Proprietes) {
  const t = useTextes(TEXTES_RESERVATION);
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

  if (
    reservation.acompte_avant == null ||
    reservation.montant_acompte == null ||
    reservation.montant_total == null
  ) {
    return null;
  }
  const acompte = formaterDevise(reservation.montant_acompte, 'MGA');
  const echeance = new Date(reservation.acompte_avant).toLocaleString(
    localeCourante(),
    { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
  );

  return (
    <div className="mt-3 rounded-xl border border-attente/40 bg-attente/10 p-4 text-left">
      <p className="flex items-center gap-2 font-semibold text-gris-700">
        <Clock size={16} aria-hidden className="text-attente" />
        {t.acompteAPayer(acompte)}
      </p>
      <p className="mt-1 text-sm text-gris-600">
        {t.acompteDetail(formaterDevise(reservation.montant_total, 'MGA'))}
      </p>
      <p className="mt-1 text-sm font-medium text-gris-700">
        {t.acompteAvant(echeance)}
      </p>

      {ouvert ? (
        <div className="mt-4 rounded-xl bg-surface p-4 shadow-sm">
          <FormulairePaiement
            cible={{ type: 'reservation', idReservation: reservation.id_reservation }}
            montant={acompte}
            devise="MGA"
            lireStatutCommande={() =>
              obtenirReservation(reservation.id_reservation).then((r) => r.statut)
            }
            onConfirme={surPaye}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 font-semibold text-white shadow-md transition hover:bg-action-fonce"
        >
          <Lock size={15} aria-hidden />
          {t.payerAcompte}
        </button>
      )}
    </div>
  );
}
