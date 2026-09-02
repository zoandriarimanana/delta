/**
 * Sélection de produits pour une commande saisie au comptoir.
 *
 * Consomme `features/produit/` en lecture — le catalogue est public, et un
 * salarié n'a pas besoin d'une vue différente de celle du client. Ce composant
 * n'écrit rien : il remonte le produit choisi, la page décide quoi en faire.
 */

import { useState } from 'react';

import { useProduits } from '@/features/produit/produit.hooks';
import { TOUTES_CATEGORIES } from '@/features/produit/produit.service';
import type { Produit } from '@/features/produit/produit.types';

import { formaterMontant } from '../commande.service';

interface Proprietes {
  surAjout: (produit: Produit) => void;
}

export default function SelecteurProduits({ surAjout }: Proprietes) {
  const { donnees, chargement, erreur } = useProduits(TOUTES_CATEGORIES);
  const [recherche, setRecherche] = useState('');

  const terme = recherche.trim().toLowerCase();
  const visibles = (donnees ?? []).filter((produit) =>
    terme === '' ? true : produit.nom.toLowerCase().includes(terme)
  );

  return (
    <div>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Rechercher un produit
        <input
          type="search"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      {chargement && (
        <p role="status" className="mt-3 text-sm text-slate-500">
          Chargement…
        </p>
      )}

      {erreur !== null && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {erreur}
        </p>
      )}

      {donnees !== null && visibles.length === 0 && (
        <p className="mt-3 text-sm text-slate-600">Aucun produit ne correspond.</p>
      )}

      <ul className="mt-3 space-y-2">
        {visibles.map((produit) => (
          <li
            key={produit.id_produit}
            className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-2"
          >
            <span className="text-sm text-slate-800">
              {produit.nom}
              <span className="ml-2 text-slate-500">
                {formaterMontant(produit.prix_unitaire)}
              </span>
            </span>
            <button
              type="button"
              // Un produit épuisé reste visible mais non ajoutable : le serveur
              // refuserait en 409, et le masquer laisserait croire qu'il
              // n'existe pas.
              disabled={produit.stock_disponible <= 0}
              onClick={() => surAjout(produit)}
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-40"
            >
              {produit.stock_disponible <= 0 ? 'Épuisé' : 'Ajouter'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
