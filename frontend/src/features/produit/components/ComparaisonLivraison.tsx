/**
 * Frais de livraison et total livré, pour la quantité choisie.
 *
 * Demandes du 7 octobre 2026 : le client doit voir le coût de la livraison
 * sur la fiche du produit — d'abord en comparant retrait et livraison, puis,
 * à la demande de l'utilisateur, en affichant directement les **frais de
 * livraison** (réglés par l'administrateur) suivis du total livré. Le prix
 * sans livraison reste lisible juste au-dessus, dans le prix du produit. Les montants sont **indicatifs** : le
 * forfait est compté une fois par commande, et sa gratuité dépend de tout le
 * panier — c'est le serveur qui calcule et fige les frais à la commande.
 *
 * Le tarif vient du module `livraison`, que ce composant consomme sans rien
 * savoir de son implémentation.
 */

import { PackageCheck, Store, Truck } from 'lucide-react';

import { formaterMontant } from '@/features/commande/commande.service';
import { useTarifLivraison } from '@/features/livraison/livraison.hooks';
import { fraisLivraison } from '@/features/livraison/livraison.service';

import type { Produit } from '../produit.types';

interface Proprietes {
  produit: Produit;
  quantite: number;
  /** Supplément de personnalisation par unité, compris dans le total. */
  supplementUnitaire?: number;
}

export default function ComparaisonLivraison({
  produit,
  quantite,
  supplementUnitaire = 0,
}: Proprietes) {
  const { tarif } = useTarifLivraison();
  const sousTotal = (Number(produit.prix_unitaire) + supplementUnitaire) * quantite;
  const multiplicateur = produit.vendu_par_personne
    ? `${quantite} personnes`
    : `${quantite}`;

  return (
    <div
      role="group"
      aria-label="Frais de livraison"
      className="divide-y divide-gris-200 rounded-xl border border-gris-200 bg-white text-sm"
    >
      {!produit.est_livrable ? (
        <Ligne
          icone={<Store size={18} aria-hidden />}
          libelle="Frais de livraison"
          detail="Ce produit n’est pas livrable : retrait sur place uniquement."
          montant="—"
        />
      ) : tarif === null ? (
        // Tarif indisponible : on tait le montant plutôt que d'en inventer un.
        <Ligne
          icone={<Truck size={18} aria-hidden />}
          libelle="Frais de livraison"
          detail="Affichés au moment de commander."
          montant="—"
        />
      ) : (
        <AvecLivraison
          tarif={tarif}
          sousTotal={sousTotal}
          detailQuantite={
            supplementUnitaire > 0
              ? `${multiplicateur} × (${formaterMontant(produit.prix_unitaire)} + ${formaterMontant(supplementUnitaire)} de personnalisation) + livraison`
              : quantite > 1
                ? `${multiplicateur} × ${formaterMontant(produit.prix_unitaire)} + livraison`
                : null
          }
        />
      )}
    </div>
  );
}

function AvecLivraison({
  tarif,
  sousTotal,
  detailQuantite,
}: {
  tarif: NonNullable<ReturnType<typeof useTarifLivraison>['tarif']>;
  sousTotal: number;
  detailQuantite: string | null;
}) {
  const frais = fraisLivraison(tarif, sousTotal);
  return (
    <>
      <Ligne
        icone={<Truck size={18} aria-hidden />}
        libelle="Frais de livraison"
        detail={
          frais === 0
            ? 'Livraison offerte pour cet achat'
            : 'Comptés une seule fois par commande'
        }
        montant={frais === 0 ? 'Offerte' : formaterMontant(frais)}
        miseEnAvant={frais === 0}
      />
      <Ligne
        icone={<PackageCheck size={18} aria-hidden />}
        libelle="Total avec livraison"
        detail={detailQuantite}
        montant={formaterMontant(sousTotal + frais)}
      />
      {tarif.seuil_gratuite !== null && frais > 0 && (
        <p className="px-4 py-2 text-xs leading-relaxed text-succes">
          Livraison offerte dès {formaterMontant(tarif.seuil_gratuite)} d’achat. Le
          retrait en boutique reste gratuit.
        </p>
      )}
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
        <span className="text-primaire">{icone}</span>
        <div>
          <p className="font-medium text-gris-700">{libelle}</p>
          {detail !== null && (
            <p
              className={`text-xs ${miseEnAvant ? 'font-medium text-succes' : 'text-gris-500'}`}
            >
              {detail}
            </p>
          )}
        </div>
      </div>
      <p className="whitespace-nowrap text-base font-semibold text-gris-700">
        {montant}
      </p>
    </div>
  );
}
