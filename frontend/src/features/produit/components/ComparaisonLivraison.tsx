/**
 * Prix en retrait et prix livré, côte à côte, pour la quantité choisie.
 *
 * Demande du 7 octobre 2026 : le client doit voir le prix **sans** et **avec**
 * livraison avant de commander. Les montants sont **indicatifs** : le
 * forfait est compté une fois par commande, et sa gratuité dépend de tout le
 * panier — c'est le serveur qui calcule et fige les frais à la commande.
 *
 * Le tarif vient du module `livraison`, que ce composant consomme sans rien
 * savoir de son implémentation.
 */

import { Store, Truck } from 'lucide-react';

import { formaterMontant } from '@/features/commande/commande.service';
import { useTarifLivraison } from '@/features/livraison/livraison.hooks';
import { fraisLivraison } from '@/features/livraison/livraison.service';

import type { Produit } from '../produit.types';

interface Proprietes {
  produit: Produit;
  quantite: number;
}

export default function ComparaisonLivraison({ produit, quantite }: Proprietes) {
  const { tarif } = useTarifLivraison();
  const sousTotal = Number(produit.prix_unitaire) * quantite;

  return (
    <div
      role="group"
      aria-label="Prix selon le mode de réception"
      className="divide-y divide-warm-gray-200 rounded-xl border border-warm-gray-200 bg-white text-sm"
    >
      <Ligne
        icone={<Store size={18} aria-hidden />}
        libelle="Retrait sur place"
        detail={
          quantite > 1
            ? `${quantite} × ${formaterMontant(produit.prix_unitaire)}`
            : null
        }
        montant={formaterMontant(sousTotal)}
      />
      {!produit.est_livrable ? (
        <p className="px-4 py-3 text-warm-gray-500">
          Ce produit se retire sur place uniquement : il n’est pas livrable.
        </p>
      ) : tarif === null ? (
        // Tarif indisponible : on tait le montant plutôt que d'en inventer un.
        <p className="px-4 py-3 text-warm-gray-500">
          Livraison possible — les frais s’affichent au moment de commander.
        </p>
      ) : (
        <AvecLivraison tarif={tarif} sousTotal={sousTotal} />
      )}
    </div>
  );
}

function AvecLivraison({
  tarif,
  sousTotal,
}: {
  tarif: NonNullable<ReturnType<typeof useTarifLivraison>['tarif']>;
  sousTotal: number;
}) {
  const frais = fraisLivraison(tarif, sousTotal);
  return (
    <>
      <Ligne
        icone={<Truck size={18} aria-hidden />}
        libelle="Avec livraison"
        detail={
          frais === 0
            ? 'Livraison offerte'
            : `dont ${formaterMontant(frais)} de livraison`
        }
        montant={formaterMontant(sousTotal + frais)}
        miseEnAvant={frais === 0}
      />
      <p className="px-4 py-2 text-xs leading-relaxed text-warm-gray-500">
        Frais comptés une seule fois par commande, quel que soit le nombre d’articles
        {tarif.seuil_gratuite !== null && (
          <> — livraison offerte dès {formaterMontant(tarif.seuil_gratuite)} d’achat</>
        )}
        .
      </p>
    </>
  );
}

function Ligne({
  icone,
  libelle,
  detail,
  montant,
  miseEnAvant = false,
}: {
  icone: React.ReactNode;
  libelle: string;
  detail: string | null;
  montant: string;
  miseEnAvant?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-terracotta">{icone}</span>
        <div>
          <p className="font-medium text-warm-gray-700">{libelle}</p>
          {detail !== null && (
            <p
              className={`text-xs ${miseEnAvant ? 'font-medium text-sage' : 'text-warm-gray-500'}`}
            >
              {detail}
            </p>
          )}
        </div>
      </div>
      <p className="whitespace-nowrap text-base font-semibold text-warm-gray-700">
        {montant}
      </p>
    </div>
  );
}
