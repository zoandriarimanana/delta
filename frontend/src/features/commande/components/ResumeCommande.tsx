/**
 * Colonne « Votre commande » du tunnel : articles, montants, validation.
 *
 * Le bouton de validation vit ici, hors du `<form>` de la colonne de gauche,
 * et lui est rattaché par l'attribut `form` : le client le voit à côté du
 * total qu'il s'apprête à payer, comme sur tout site marchand.
 */

import { Link } from 'react-router';
import { Lock, PackageCheck, Store } from 'lucide-react';

import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';
import { supplementLigne } from '../commande.service';
import type { LignePanier } from '../commande.types';
import RecapitulatifMontants from './RecapitulatifMontants';
import { urlPhoto } from '@/features/galerie/galerie.api';
import VignetteProduit from './VignetteProduit';

interface Proprietes {
  lignes: LignePanier[];
  sousTotal: number;
  avecLivraison: boolean;
  idFormulaire: string;
  envoi: boolean;
}

export default function ResumeCommande({
  lignes,
  sousTotal,
  avecLivraison,
  idFormulaire,
  envoi,
}: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const prix = useFormaterPrix();
  return (
    <aside
      aria-labelledby="titre-votre-commande"
      className="rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm lg:sticky lg:top-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="titre-votre-commande" className="text-lg font-semibold text-gris-700">
          {t.votreCommande}
        </h2>
        <Link
          to="/panier"
          className="text-sm font-medium text-primaire no-underline hover:underline"
        >
          {t.modifier}
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-gris-200">
        {lignes.map((ligne) => (
          <li key={ligne.id_produit} className="flex items-center gap-3 py-3">
            <span className="relative">
              <VignetteProduit
                idProduit={ligne.id_produit}
                nom={ligne.nom}
                image={
                  ligne.photo
                    ? urlPhoto({ produit: ligne.id_produit }, ligne.photo)
                    : undefined
                }
                className="h-14 w-14"
              />
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-gris-600 px-1 text-xs font-semibold text-white">
                {ligne.quantite}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gris-700">
                {ligne.vendu_par_personne
                  ? t.personnesPour(ligne.nom, ligne.quantite)
                  : `${ligne.nom} × ${ligne.quantite}`}
              </span>
              <span className="block text-xs text-gris-500">
                {prix(ligne.prix_unitaire)} /{' '}
                {ligne.vendu_par_personne ? t.personne : ligne.unite_mesure}
              </span>
              {ligne.personnalisation !== undefined && (
                <span className="mt-0.5 block text-xs font-medium text-attente">
                  {t.personnalise}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-gris-700">
              {prix(
                Number(ligne.prix_unitaire) * ligne.quantite + supplementLigne(ligne)
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <RecapitulatifMontants sousTotal={sousTotal} avecLivraison={avecLivraison} />
      </div>

      <button
        type="submit"
        form={idFormulaire}
        disabled={envoi}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-fonce hover:shadow-lg disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
      >
        <Lock size={16} aria-hidden />
        {envoi ? t.envoi : t.validerCommande}
      </button>
      <p className="mt-2 text-center text-xs text-gris-500">{t.montantsConfirmes}</p>

      <ul className="mt-5 space-y-2 border-t border-gris-200 pt-4 text-xs text-gris-500">
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
