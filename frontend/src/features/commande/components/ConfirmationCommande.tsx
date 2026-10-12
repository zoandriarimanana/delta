/**
 * Après la validation d'une commande passée avec un compte : l'étape
 * « Paiement », puis la confirmation une fois le paiement reçu.
 *
 * Une commande invitée a sa propre page publique (par sa référence) : ce
 * composant ne la concerne pas.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, ClipboardList, ShoppingBag } from 'lucide-react';

import { montantAPayer } from '@/features/devise/devise.service';
import { useTextes } from '@/lib/langue';

import { recupererCommande } from '../commande.api';
import { TEXTES_COMMANDE } from '../commande.textes';
import EtapePaiement from './EtapePaiement';
import { formaterMontant } from '../commande.service';
import type { Commande } from '../commande.types';
import EtapesCommande from './EtapesCommande';

interface Proprietes {
  commande: Commande;
}

export default function ConfirmationCommande({ commande }: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const frais = Number(commande.frais_livraison);
  const [payee, setPayee] = useState(commande.statut !== 'En_attente');

  if (!payee) {
    return (
      <section>
        <EtapesCommande courante="Paiement" />
        <div className="mx-auto mt-8 max-w-xl">
          <EtapePaiement
            commande={commande}
            cible={{ type: 'client', idCommande: commande.id_commande }}
            lireStatutCommande={() =>
              recupererCommande(commande.id_commande).then((c) => c.statut)
            }
            surPaye={() => setPayee(true)}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <EtapesCommande courante="Confirmation" />

      <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-gris-200 bg-surface p-8 text-center shadow-sm">
        <CheckCircle2 size={56} aria-hidden className="mx-auto text-succes" />
        <h1 className="mt-4 text-3xl font-semibold text-gris-700">
          {t.commandeConfirmee}
        </h1>
        <p className="mt-3 text-gris-600">{t.merciPaiement(commande.id_commande)}</p>
        <p className="mt-1 text-sm text-gris-500">
          {montantAPayer(commande)}
          {frais > 0 && t.dontLivraison(formaterMontant(commande.frais_livraison))}
        </p>
        <p className="mt-2 text-sm text-gris-500">{t.suivreDepuis}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/commandes"
            className="inline-flex items-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white no-underline shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-fonce"
          >
            <ClipboardList size={18} aria-hidden />
            {t.suivreCommandes}
          </Link>
          <Link
            to="/produits"
            className="inline-flex items-center gap-2 rounded-full border border-gris-300 bg-surface px-6 py-3 font-medium text-gris-700 no-underline transition-colors hover:border-primaire hover:text-primaire"
          >
            <ShoppingBag size={18} aria-hidden />
            {t.continuerAchats}
          </Link>
        </div>
      </div>
    </section>
  );
}
