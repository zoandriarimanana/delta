/** Vignette d'un produit dans la liste du catalogue. */

import { Link } from 'react-router';

import { usePanier } from '@/features/commande/commande.hooks';
import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import Carte from '@/components/ui/Carte';
import { imageProduit } from '@/lib/images';

import { estDisponible, formaterPrix } from '../produit.service';
import type { Produit } from '../produit.types';

interface Proprietes {
  produit: Produit;
}

export default function ProduitCarte({ produit }: Proprietes) {
  const disponible = estDisponible(produit);
  const panier = usePanier();

  return (
    <Link to={`/produits/${produit.id_produit}`} className="no-underline">
      <Carte
        image={imageProduit(produit.id_produit, produit.nom)}
        titre={produit.nom}
        description={produit.description}
        pied={
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-terracotta">
              {formaterPrix(produit)}
            </span>
            {/* Le module choisit **son** libellé et **sa** variante : la
                pastille ne connaît ni le stock ni le produit. */}
            <Badge variante={disponible ? 'positif' : 'negatif'}>
              {disponible ? 'Disponible' : 'Épuisé'}
            </Badge>
          </div>
        }
      >
        {disponible && (
          <Bouton
            onClick={(evenement) => {
              // La vignette entière est un lien : sans cette interception, le
              // clic ajouterait au panier **et** naviguerait vers la fiche.
              evenement.preventDefault();
              panier.ajouter(produit);
            }}
            className="mt-3 w-full"
          >
            Ajouter au panier
          </Bouton>
        )}
      </Carte>
    </Link>
  );
}
