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

import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { useTarifLivraison } from '@/features/livraison/livraison.hooks';
import { fraisLivraison } from '@/features/livraison/livraison.service';
import { useTextes } from '@/lib/langue';

import { TEXTES_PRODUIT } from '../produit.textes';
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
  const t = useTextes(TEXTES_PRODUIT);
  const prix = useFormaterPrix();
  const { tarif } = useTarifLivraison();
  const sousTotal = (Number(produit.prix_unitaire) + supplementUnitaire) * quantite;
  const multiplicateur = produit.vendu_par_personne
    ? t.personnes(quantite)
    : `${quantite}`;

  return (
    <div
      role="group"
      aria-label={t.fraisLivraison}
      className="divide-y divide-gris-200 rounded-xl border border-gris-200 bg-surface text-sm"
    >
      {!produit.est_livrable ? (
        <Ligne
          icone={<Store size={18} aria-hidden />}
          libelle={t.fraisLivraison}
          detail={t.nonLivrable}
          montant="—"
        />
      ) : tarif === null ? (
        // Tarif indisponible : on tait le montant plutôt que d'en inventer un.
        <Ligne
          icone={<Truck size={18} aria-hidden />}
          libelle={t.fraisLivraison}
          detail={t.fraisAuCheckout}
          montant="—"
        />
      ) : (
        <AvecLivraison
          tarif={tarif}
          sousTotal={sousTotal}
          detailQuantite={
            supplementUnitaire > 0
              ? t.detailAvecPerso(
                  multiplicateur,
                  prix(produit.prix_unitaire),
                  prix(supplementUnitaire)
                )
              : quantite > 1
                ? t.detailSimple(multiplicateur, prix(produit.prix_unitaire))
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
  const t = useTextes(TEXTES_PRODUIT);
  const prix = useFormaterPrix();
  const frais = fraisLivraison(tarif, sousTotal);
  return (
    <>
      <Ligne
        icone={<Truck size={18} aria-hidden />}
        libelle={t.fraisLivraison}
        detail={frais === 0 ? t.livraisonOfferteAchat : t.uneFoisParCommande}
        montant={frais === 0 ? t.offerte : prix(frais)}
        miseEnAvant={frais === 0}
      />
      <Ligne
        icone={<PackageCheck size={18} aria-hidden />}
        libelle={t.totalAvecLivraison}
        detail={detailQuantite}
        montant={prix(sousTotal + frais)}
      />
      {tarif.seuil_gratuite !== null && frais > 0 && (
        <p className="px-4 py-2 text-xs leading-relaxed text-succes">
          {t.seuilGratuite(prix(tarif.seuil_gratuite))}
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
