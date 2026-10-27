/**
 * Heure limite de paiement d'une commande (13 octobre 2026) : au-delà, le
 * serveur l'annule et rend son stock. L'échéance vient de l'API
 * (`paiement_avant`), jamais recalculée ici ; rien si elle n'existe pas.
 */

import { Clock } from 'lucide-react';

import { localeCourante, useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';

export default function EcheancePaiement({
  paiementAvant,
}: {
  paiementAvant: string | null | undefined;
}) {
  const t = useTextes(TEXTES_COMMANDE);
  if (paiementAvant == null) return null;
  const heure = new Date(paiementAvant).toLocaleString(localeCourante(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-attente">
      <Clock size={13} aria-hidden />
      {t.payerAvant(heure)}
    </p>
  );
}
