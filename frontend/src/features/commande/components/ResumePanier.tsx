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

import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { useTarifLivraison } from '@/features/livraison/livraison.hooks';
import { resteAvantGratuite } from '@/features/livraison/livraison.service';
import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';

interface Proprietes {
  nombreArticles: number;
  sousTotal: number;
}

export default function ResumePanier({ nombreArticles, sousTotal }: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const prix = useFormaterPrix();
  const { tarif } = useTarifLivraison();
  const seuil = tarif?.seuil_gratuite == null ? null : Number(tarif.seuil_gratuite);
  const reste = tarif === null ? null : resteAvantGratuite(tarif, sousTotal);
  const progression = seuil === null ? 0 : Math.min(100, (sousTotal / seuil) * 100);

  return (
    <aside
      aria-labelledby="titre-recapitulatif"
      className="rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm lg:sticky lg:top-6"
    >
      <h2 id="titre-recapitulatif" className="text-lg font-semibold text-gris-700">
        {t.recapitulatif}
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-gris-500">{t.sousTotal(nombreArticles)}</dt>
          <dd className="font-medium text-gris-700">{prix(sousTotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gris-500">{t.livraison}</dt>
          <dd className="text-right text-gris-700">
            {tarif === null
              ? t.livraisonEtapeSuivante
              : reste === null && seuil !== null
                ? t.offerte
                : t.siLivree(prix(tarif.forfait))}
          </dd>
        </div>
      </dl>

      {tarif !== null && seuil !== null && (
        <div className="mt-4 rounded-xl bg-succes/10 p-3">
          <p className="text-xs font-medium text-succes">
            {reste === null ? t.livraisonOfferteBravo : t.plusQue(prix(reste))}
          </p>
          <div
            role="progressbar"
            aria-label={t.progressionLivraison}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progression)}
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface"
          >
            <div
              className="h-full rounded-full bg-succes transition-all"
              style={{ width: `${progression}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-baseline justify-between border-t border-gris-200 pt-4">
        <span className="font-semibold text-gris-700">{t.totalEstime}</span>
        <span className="text-2xl font-bold text-primaire">{prix(sousTotal)}</span>
      </div>
      {/* Indicatif : le serveur recalcule à partir des prix du catalogue. */}
      <p className="mt-1 text-xs text-gris-500">{t.montantIndicatif}</p>

      <Link
        to="/commande"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white no-underline shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-fonce hover:shadow-lg"
      >
        {t.validerCommande}
        <ArrowRight size={18} aria-hidden />
      </Link>
      <Link
        to="/produits"
        className="mt-3 block text-center text-sm font-medium text-gris-600 no-underline hover:text-primaire"
      >
        {t.continuerAchats}
      </Link>

      <ul className="mt-6 space-y-2 border-t border-gris-200 pt-4 text-xs text-gris-500">
        <li className="flex items-center gap-2">
          <ShieldCheck size={16} aria-hidden className="text-succes" />
          {t.avecOuSansCompte}
        </li>
        <li className="flex items-center gap-2">
          <PackageCheck size={16} aria-hidden className="text-succes" />
          {t.suiviEnLigne}
        </li>
        <li className="flex items-center gap-2">
          <Store size={16} aria-hidden className="text-succes" />
          {t.retraitGratuit}
        </li>
      </ul>
    </aside>
  );
}
