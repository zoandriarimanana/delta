/** Vignette d'un produit dans la liste du catalogue. */

import { Link } from 'react-router';

import Card from '@/components/Card';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import { getProductImage } from '@/lib/images';
import { usePanier } from '@/features/commande/commande.hooks';

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
      <Card
        image={getProductImage(produit.nom)}
        title={produit.nom}
        description={produit.description}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-terracotta">
              {formaterPrix(produit)}
            </span>
            <Badge status={disponible ? 'disponible' : 'epuisee'} />
          </div>
        }
      >
        {disponible && (
          <Button
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              panier.ajouter(produit);
            }}
            className="w-full mt-3"
          >
            Ajouter au panier
          </Button>
        )}
      </Card>
    </Link>
  );
}
