/**
 * Écran de confirmation d'une commande passée avec un compte.
 *
 * Une commande invitée a sa propre page publique (par sa référence) : ce
 * composant ne la concerne pas.
 */

import { Link } from 'react-router';
import { CheckCircle2, ClipboardList, ShoppingBag } from 'lucide-react';

import { formaterMontant } from '../commande.service';
import type { Commande } from '../commande.types';
import EtapesCommande from './EtapesCommande';

interface Proprietes {
  commande: Commande;
}

export default function ConfirmationCommande({ commande }: Proprietes) {
  const frais = Number(commande.frais_livraison);

  return (
    <section>
      <EtapesCommande courante="Confirmation" />

      <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-gris-200 bg-surface p-8 text-center shadow-sm">
        <CheckCircle2 size={56} aria-hidden className="mx-auto text-succes" />
        <h1 className="mt-4 text-3xl font-semibold text-gris-700">
          Commande enregistrée
        </h1>
        <p className="mt-3 text-gris-600">
          Merci ! Votre commande n° {commande.id_commande} est enregistrée pour un
          montant de {formaterMontant(commande.montant_total)}
          {frais > 0 && (
            <>, dont {formaterMontant(commande.frais_livraison)} de livraison</>
          )}
          .
        </p>
        <p className="mt-2 text-sm text-gris-500">
          Vous pouvez suivre son avancement à tout moment depuis « Mes commandes ».
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/commandes"
            className="inline-flex items-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white no-underline shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-fonce"
          >
            <ClipboardList size={18} aria-hidden />
            Suivre mes commandes
          </Link>
          <Link
            to="/produits"
            className="inline-flex items-center gap-2 rounded-full border border-gris-300 bg-surface px-6 py-3 font-medium text-gris-700 no-underline transition-colors hover:border-primaire hover:text-primaire"
          >
            <ShoppingBag size={18} aria-hidden />
            Continuer mes achats
          </Link>
        </div>
      </div>
    </section>
  );
}
