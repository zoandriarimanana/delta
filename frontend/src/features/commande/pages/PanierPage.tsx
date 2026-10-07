/** Panier : lignes, quantités, récapitulatif, accès au tunnel. */

import { Link } from 'react-router';
import { GraduationCap, ShoppingBag } from 'lucide-react';

import EtapesCommande from '../components/EtapesCommande';
import LignePanierCarte from '../components/LignePanierCarte';
import ResumePanier from '../components/ResumePanier';
import { usePanier } from '../commande.hooks';

export default function PanierPage() {
  const panier = usePanier();

  if (panier.lignes.length === 0) {
    return <PanierVide />;
  }

  return (
    <section>
      <EtapesCommande courante="Panier" />

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold text-gris-700">Mon panier</h1>
        <p className="text-sm text-gris-500">
          {panier.nombre} article{panier.nombre > 1 ? 's' : ''}
        </p>
      </div>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-2xl border border-gris-200 bg-surface px-5 shadow-sm">
          <ul className="divide-y divide-gris-200">
            {panier.lignes.map((ligne) => (
              <LignePanierCarte
                key={ligne.id_produit}
                ligne={ligne}
                surQuantite={(quantite) => panier.modifier(ligne.id_produit, quantite)}
                surRetrait={() => panier.retirer(ligne.id_produit)}
                surPersonnalisation={(personnalisation) =>
                  panier.personnaliser(ligne.id_produit, personnalisation)
                }
              />
            ))}
          </ul>
          <div className="flex justify-end border-t border-gris-200 py-4">
            <button
              type="button"
              onClick={panier.vider}
              className="text-sm text-gris-500 underline-offset-2 transition-colors hover:text-primaire hover:underline"
            >
              Vider le panier
            </button>
          </div>
        </div>

        <ResumePanier nombreArticles={panier.nombre} sousTotal={panier.total} />
      </div>
    </section>
  );
}

function PanierVide() {
  return (
    <section className="mx-auto max-w-lg py-12 text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primaire/10 text-primaire">
        <ShoppingBag size={36} aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-semibold text-gris-700">Mon panier</h1>
      <p className="mt-3 text-gris-500">
        Votre panier est vide. Laissez-vous tenter par nos pâtisseries, pains et
        confitures maison.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/produits"
          className="inline-flex items-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white no-underline shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-fonce"
        >
          <ShoppingBag size={18} aria-hidden />
          Découvrir nos produits
        </Link>
        <Link
          to="/formations"
          className="inline-flex items-center gap-2 rounded-full border border-gris-300 bg-surface px-6 py-3 font-medium text-gris-700 no-underline transition-colors hover:border-primaire hover:text-primaire"
        >
          <GraduationCap size={18} aria-hidden />
          Voir les formations
        </Link>
      </div>
    </section>
  );
}
