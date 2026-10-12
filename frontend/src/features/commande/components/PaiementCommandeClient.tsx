/**
 * Paiement d'une commande en attente, dans « Mes commandes ».
 *
 * Fermé, c'est un **bandeau d'appel** : ce qui reste dû, les moyens acceptés,
 * un bouton « Payer maintenant ». Ouvert, c'est le **même parcours** que juste
 * après la validation (`EtapePaiement`) — choix de l'opérateur, numéro,
 * validation sur le téléphone —, dans un cadre à part. Monter le formulaire
 * complet dans chaque carte en attente noyait la liste ; il ne s'affiche
 * désormais que pour la commande que le client a choisi de régler.
 */

import { useState } from 'react';
import { Clock, CreditCard, Lock, X } from 'lucide-react';

import { montantAPayer } from '@/features/devise/devise.service';
import FormulairePaiement from '@/features/paiement/components/FormulairePaiement';
import { OPERATEURS } from '@/features/paiement/paiement.service';
import { useTextes } from '@/lib/langue';

import { recupererCommande } from '../commande.api';
import { TEXTES_COMMANDE } from '../commande.textes';
import type { Commande } from '../commande.types';

interface Proprietes {
  commande: Commande;
  surPaye: () => void;
}

export default function PaiementCommandeClient({ commande, surPaye }: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const [ouvert, setOuvert] = useState(false);
  const montant = montantAPayer(commande);
  const enAriary = commande.devise === 'MGA';

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-4 border-t border-attente/30 bg-attente/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attente/20 text-attente">
            <Clock size={20} aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-gris-700">{t.paiementEnAttente}</p>
            <p className="text-sm text-gris-600">{t.resteAPayer(montant)}</p>
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="sr-only">{t.moyensAcceptes}</span>
              {enAriary &&
                OPERATEURS.map((o) => (
                  <span
                    key={o.fournisseur}
                    title={o.nom}
                    className={`flex h-6 items-center rounded-full px-2 text-[11px] font-bold ${o.pastille}`}
                  >
                    {o.nom}
                  </span>
                ))}
              <span className="flex h-6 items-center gap-1 rounded-full border border-gris-300 bg-surface px-2 text-[11px] font-semibold text-gris-600">
                <CreditCard size={12} aria-hidden />
                {t.carteBancaire}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-action-fonce"
        >
          <Lock size={16} aria-hidden />
          {t.payerMaintenant}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={t.reglerCommande(commande.id_commande)}
      className="border-t border-gris-200 bg-fond px-5 py-5"
    >
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-gris-200 bg-surface shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-gris-200 bg-primaire/5 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gris-600">{t.totalAPayer}</p>
            <p className="text-2xl font-bold text-primaire">{montant}</p>
          </div>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            aria-label={t.fermerPaiement}
            className="rounded-full p-1.5 text-gris-500 hover:bg-gris-100 hover:text-gris-700"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="px-5 py-5">
          <FormulairePaiement
            cible={{ type: 'client', idCommande: commande.id_commande }}
            devise={commande.devise}
            montant={montant}
            lireStatutCommande={() =>
              recupererCommande(commande.id_commande).then((c) => c.statut)
            }
            onConfirme={surPaye}
          />
        </div>
      </div>
    </section>
  );
}
