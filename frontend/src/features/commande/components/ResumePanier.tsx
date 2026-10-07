/**
 * Récapitulatif du panier : sous-total, livraison, total, accès au tunnel.
 *
 * La livraison n'est pas encore choisie à cette étape : on annonce son tarif
 * et ce qu'il manque pour qu'elle soit offerte, sans l'ajouter au total — le
 * retrait en boutique reste gratuit. Tous les montants sont indicatifs : le
 * serveur recalcule et fige à la commande.
 */

import { Link } from 'react-router';
import { ArrowRight, PackageCheck, ShieldCheck, Store } from 'lucide-react';

import { useTarifLivraison } from '@/features/livraison/livraison.hooks';
import { resteAvantGratuite } from '@/features/livraison/livraison.service';

import { formaterMontant } from '../commande.service';

interface Proprietes {
  nombreArticles: number;
  sousTotal: number;
}

export default function ResumePanier({ nombreArticles, sousTotal }: Proprietes) {
  const { tarif } = useTarifLivraison();
  const seuil = tarif?.seuil_gratuite == null ? null : Number(tarif.seuil_gratuite);
  const reste = tarif === null ? null : resteAvantGratuite(tarif, sousTotal);
  const progression = seuil === null ? 0 : Math.min(100, (sousTotal / seuil) * 100);

  return (
    <aside
      aria-labelledby="titre-recapitulatif"
      className="rounded-2xl border border-warm-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-6"
    >
      <h2 id="titre-recapitulatif" className="text-lg font-semibold text-warm-gray-700">
        Récapitulatif
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-warm-gray-500">
            Sous-total ({nombreArticles} article{nombreArticles > 1 ? 's' : ''})
          </dt>
          <dd className="font-medium text-warm-gray-700">
            {formaterMontant(sousTotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-warm-gray-500">Livraison</dt>
          <dd className="text-right text-warm-gray-700">
            {tarif === null
              ? 'Choisie à l’étape suivante'
              : reste === null && seuil !== null
                ? 'Offerte'
                : `${formaterMontant(tarif.forfait)} si livrée`}
          </dd>
        </div>
      </dl>

      {tarif !== null && seuil !== null && (
        <div className="mt-4 rounded-xl bg-sage/10 p-3">
          <p className="text-xs font-medium text-sage">
            {reste === null
              ? 'Bravo, la livraison vous est offerte !'
              : `Plus que ${formaterMontant(reste)} pour la livraison offerte`}
          </p>
          <div
            role="progressbar"
            aria-label="Progression vers la livraison offerte"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progression)}
            className="mt-2 h-2 overflow-hidden rounded-full bg-white"
          >
            <div
              className="h-full rounded-full bg-sage transition-all"
              style={{ width: `${progression}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-baseline justify-between border-t border-warm-gray-200 pt-4">
        <span className="font-semibold text-warm-gray-700">Total estimé</span>
        <span className="text-2xl font-bold text-terracotta">
          {formaterMontant(sousTotal)}
        </span>
      </div>
      {/* Indicatif : le serveur recalcule à partir des prix du catalogue. */}
      <p className="mt-1 text-xs text-warm-gray-500">
        Montant indicatif, confirmé à la validation. Frais de livraison ajoutés à
        l’étape suivante si vous choisissez d’être livré.
      </p>

      <Link
        to="/commande"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 font-semibold text-white no-underline shadow-md transition-all hover:-translate-y-0.5 hover:bg-burgundy hover:shadow-lg"
      >
        Valider la commande
        <ArrowRight size={18} aria-hidden />
      </Link>
      <Link
        to="/produits"
        className="mt-3 block text-center text-sm font-medium text-warm-gray-600 no-underline hover:text-terracotta"
      >
        Continuer mes achats
      </Link>

      <ul className="mt-6 space-y-2 border-t border-warm-gray-200 pt-4 text-xs text-warm-gray-500">
        <li className="flex items-center gap-2">
          <ShieldCheck size={16} aria-hidden className="text-sage" />
          Commande possible avec ou sans compte
        </li>
        <li className="flex items-center gap-2">
          <PackageCheck size={16} aria-hidden className="text-sage" />
          Suivi de votre commande en ligne
        </li>
        <li className="flex items-center gap-2">
          <Store size={16} aria-hidden className="text-sage" />
          Retrait en boutique gratuit
        </li>
      </ul>
    </aside>
  );
}
