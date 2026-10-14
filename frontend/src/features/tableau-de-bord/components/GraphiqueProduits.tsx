/**
 * Colonnes des produits les plus vendus (14 octobre 2026), par quantité ou par
 * chiffre d'affaires selon le classement choisi. Chaque colonne porte sa
 * valeur ; la photo et le nom du produit sont dessous.
 */

import { Link } from 'react-router';

import { formaterMontant } from '@/features/commande/commande.service';
import { urlPhotoPartie } from '@/features/galerie/galerie.api';
import { imageProduit } from '@/lib/images';

import { part, type Classement } from '../tableauDeBord.service';
import type { VenteProduit } from '../tableauDeBord.types';

interface Proprietes {
  produits: VenteProduit[];
  classement: Classement;
  couvertures: Record<string, string>;
}

export default function GraphiqueProduits({
  produits,
  classement,
  couvertures,
}: Proprietes) {
  if (produits.length === 0) {
    return (
      <p className="py-10 text-center text-gris-500">Aucune vente sur cette période.</p>
    );
  }
  const premier = produits[0];

  return (
    <ol
      aria-label="Produits les plus vendus"
      className="flex h-72 items-end gap-2 overflow-x-auto pb-1 sm:gap-3"
    >
      {produits.map((produit, rang) => {
        const hauteur = Math.max(part(produit, premier, classement), 3);
        const fichier = couvertures[String(produit.id_produit)];
        const image =
          fichier === undefined
            ? imageProduit(produit.id_produit, produit.nom)
            : urlPhotoPartie('produits', fichier);
        const valeur =
          classement === 'quantite'
            ? String(produit.unites_vendues)
            : formaterMontant(produit.chiffre_affaires);
        return (
          <li
            key={produit.id_produit}
            className="flex h-full min-w-16 flex-1 flex-col items-center justify-end"
            title={`${produit.nom} — ${produit.unites_vendues} vendu(s), ${formaterMontant(
              produit.chiffre_affaires
            )}, ${produit.nombre_commandes} commande(s)`}
          >
            <span className="mb-1 whitespace-nowrap text-xs font-semibold text-gris-700">
              {valeur}
            </span>
            <div
              className={`w-full max-w-14 rounded-t-lg ${
                rang === 0 ? 'bg-action' : 'bg-primaire'
              }`}
              style={{ height: `${hauteur}%` }}
            />
            <img
              src={image}
              alt=""
              className="mt-2 h-9 w-9 shrink-0 rounded-lg object-cover"
            />
            <Link
              to={`/personnel/catalogue/${produit.id_produit}`}
              className="mt-1 line-clamp-2 h-8 w-full text-center text-[11px] leading-4 text-gris-600 no-underline hover:text-primaire"
            >
              {produit.nom}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
