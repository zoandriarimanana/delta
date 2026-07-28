/** Panier : lignes, quantités, total d'affichage, accès au tunnel. */

import { Link } from 'react-router';

import ChampQuantite from '../components/ChampQuantite';
import { usePanier } from '../commande.hooks';
import { formaterMontant } from '../commande.service';

export default function PanierPage() {
  const panier = usePanier();

  if (panier.lignes.length === 0) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Panier</h1>
        <p className="mt-2 text-slate-600">Votre panier est vide.</p>
        <Link to="/produits" className="mt-4 inline-block text-slate-900 underline">
          Parcourir le catalogue
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Panier</h1>

      <ul className="mt-6 divide-y divide-slate-200">
        {panier.lignes.map((ligne) => (
          <li key={ligne.id_produit} className="flex flex-wrap items-center gap-4 py-4">
            <span className="flex-1 text-slate-900">{ligne.nom}</span>
            <span className="text-slate-600">
              {formaterMontant(ligne.prix_unitaire)} / {ligne.unite_mesure}
            </span>
            <ChampQuantite
              ligne={ligne}
              onChangement={(quantite) => panier.modifier(ligne.id_produit, quantite)}
            />
            <button
              type="button"
              onClick={() => panier.retirer(ligne.id_produit)}
              className="text-sm text-red-700 underline"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-right text-lg font-semibold text-slate-900">
        Total : {formaterMontant(panier.total)}
      </p>
      {/* Le total est indicatif : le serveur recalcule à partir des prix du
          catalogue au moment de la commande. */}
      <p className="text-right text-sm text-slate-500">
        Montant indicatif, confirmé à la validation.
      </p>

      <div className="mt-6 flex gap-4">
        <Link to="/commande" className="rounded bg-slate-900 px-4 py-2 text-white">
          Valider la commande
        </Link>
        <button
          type="button"
          onClick={panier.vider}
          className="text-sm text-slate-700 underline"
        >
          Vider le panier
        </button>
      </div>
    </section>
  );
}
