/**
 * Où en est l'acompte d'une réservation, en une mention courte — pour
 * l'administration (13 octobre 2026). Rien si aucun acompte n'est demandé.
 */

import { formaterDate } from '@/features/commande/commande.service';

import type { Reservation } from '../reservation.types';

export default function EtatAcompte({ reservation }: { reservation: Reservation }) {
  if (reservation.montant_acompte == null) return null;
  if (reservation.acompte_paye) {
    return <span className="text-xs font-semibold text-succes">Acompte payé</span>;
  }
  if (reservation.acompte_avant != null) {
    return (
      <span className="text-xs font-semibold text-attente">
        Acompte dû avant le {formaterDate(reservation.acompte_avant)}
      </span>
    );
  }
  return <span className="text-xs text-gris-500">Acompte non payé</span>;
}
