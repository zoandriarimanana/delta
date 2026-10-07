/**
 * Une commande dans « Mes commandes » : l'essentiel d'un coup d'œil, le
 * détail à la demande.
 *
 * En-tête toujours visible — numéro, date, statut, mode de réception,
 * vignettes et total. Le détail (articles, montants, suivi de livraison) est
 * déplié d'office pour une commande en cours, replié pour les autres : ce qui
 * est fini se consulte, ce qui est en cours se suit.
 *
 * Le paiement n'est proposé que pour une commande **en attente** : une
 * commande confirmée l'est déjà, une annulée ne peut plus l'être (409
 * serveur). Le module `paiement` fournit le formulaire, monté sans rien
 * savoir de son implémentation.
 */

import { useState } from 'react';
import { ChevronDown, CreditCard, Store, Truck, UtensilsCrossed } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import { EncartSuiviCommande } from '@/features/livraison/components/EncartSuivi';
import FormulairePaiement from '@/features/paiement/components/FormulairePaiement';

import {
  etapeCommande,
  formaterDate,
  formaterMontant,
  libelleModeReception,
  libelleStatutCommande,
  varianteStatutCommande,
} from '../commande.service';
import type { Commande } from '../commande.types';
import RecapitulatifCommande from './RecapitulatifCommande';
import VignetteProduit from './VignetteProduit';

const ICONES_MODE = { En_ligne: Truck, A_emporter: Store, Sur_place: UtensilsCrossed };
const VIGNETTES_MAX = 4;

interface Proprietes {
  commande: Commande;
  surPaiementConfirme: () => void;
}

export default function CarteCommandeClient({
  commande,
  surPaiementConfirme,
}: Proprietes) {
  const [ouverte, setOuverte] = useState(etapeCommande(commande) === 'en_cours');
  const IconeMode = ICONES_MODE[commande.type_commande] ?? Store;
  const articles = commande.lignes.reduce((total, ligne) => total + ligne.quantite, 0);
  const autres = commande.lignes.length - VIGNETTES_MAX;

  return (
    <li className="overflow-hidden rounded-2xl border border-gris-200 bg-surface shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gris-700">
              Commande n° {commande.id_commande}
            </h2>
            <Badge variante={varianteStatutCommande(commande.statut)}>
              {libelleStatutCommande(commande.statut)}
            </Badge>
          </div>
          {/* La date répond à « quand ai-je commandé ? », ce qu'un numéro ne
              dit pas. `<time>` porte la valeur brute pour les lecteurs
              d'écran et les outils, le texte reste lisible. */}
          <p className="mt-1 text-sm text-gris-500">
            Passée le{' '}
            <time dateTime={commande.date_commande}>
              {formaterDate(commande.date_commande)}
            </time>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-gris-600">
            <IconeMode size={16} aria-hidden className="text-primaire" />
            {libelleModeReception(commande.type_commande)} · {articles} article
            {articles > 1 ? 's' : ''}
          </p>
          <ul aria-label="Articles" className="mt-3 flex items-center gap-2">
            {commande.lignes.slice(0, VIGNETTES_MAX).map((ligne) => (
              <li key={ligne.id_ligne}>
                <VignetteProduit
                  idProduit={ligne.id_produit}
                  nom={ligne.nom_produit}
                  className="h-12 w-12"
                />
              </li>
            ))}
            {autres > 0 && (
              <li className="flex h-12 w-12 items-center justify-center rounded-xl bg-gris-100 text-sm font-medium text-gris-600">
                +{autres}
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <p className="text-2xl font-bold text-primaire">
            {formaterMontant(commande.montant_total)}
          </p>
          <button
            type="button"
            onClick={() => setOuverte((valeur) => !valeur)}
            aria-expanded={ouverte}
            className="inline-flex items-center gap-1 text-sm font-medium text-gris-600 hover:text-primaire"
          >
            {ouverte ? 'Masquer le détail' : 'Voir le détail'}
            <ChevronDown
              size={16}
              aria-hidden
              className={`transition-transform ${ouverte ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {commande.statut === 'En_attente' && (
        <div className="border-t border-attente/30 bg-attente/10 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-gris-700">
            <CreditCard size={16} aria-hidden className="text-attente" />
            Paiement en attente
          </p>
          <p className="mt-1 text-xs text-gris-500">
            Réglez votre commande en ligne pour qu’elle soit confirmée.
          </p>
          <FormulairePaiement
            idCommande={commande.id_commande}
            onConfirme={surPaiementConfirme}
          />
        </div>
      )}

      {ouverte && (
        <div className="border-t border-gris-200 px-5 pb-5">
          <RecapitulatifCommande commande={commande} afficherStatut={false} />
          {/* N'affiche rien pour une commande à retirer. */}
          <EncartSuiviCommande idCommande={commande.id_commande} />
        </div>
      )}
    </li>
  );
}
