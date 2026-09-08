/**
 * Une ligne du tableau d'administration des produits.
 *
 * Extraite pour que la page reste lisible : elle porte l'état archivé, les
 * actions, et rien d'autre.
 */

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import { estArchive } from '../produit.administration';
import { formaterPrix } from '../produit.service';
import type {
  CategorieProduitAdministration,
  ProduitAdministration,
} from '../produit.types';

interface Proprietes {
  produit: ProduitAdministration;
  categories: CategorieProduitAdministration[];
  envoi: boolean;
  surModification: (produit: ProduitAdministration) => void;
  surArchivage: (idProduit: number) => void;
  surRestauration: (idProduit: number) => void;
}

export default function LigneProduitAdministration({
  produit,
  categories,
  envoi,
  surModification,
  surArchivage,
  surRestauration,
}: Proprietes) {
  const archive = estArchive(produit);
  const categorie = categories.find((c) => c.id_categorie === produit.id_categorie);

  return (
    <tr className={archive ? 'bg-warm-gray-100/60' : undefined}>
      <td className="px-3 py-2 text-sm text-warm-gray-700">{produit.nom}</td>
      <td className="px-3 py-2 text-sm text-warm-gray-600">
        {categorie?.libelle ?? '—'}
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">{formaterPrix(produit)}</td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        {produit.stock_disponible}
      </td>
      <td className="px-3 py-2">
        {/* Le libellé et la variante viennent d'ici, pas de la pastille : elle
            ne connaît aucune entité. */}
        <Badge variante={archive ? 'negatif' : 'positif'}>
          {archive ? 'Archivé' : 'Actif'}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          {archive ? (
            <Bouton
              variante="secondaire"
              disabled={envoi}
              onClick={() => surRestauration(produit.id_produit)}
            >
              Restaurer
            </Bouton>
          ) : (
            <>
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => surModification(produit)}
              >
                Modifier
              </Bouton>
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => surArchivage(produit.id_produit)}
              >
                {/* « Archiver » et non « Supprimer » : `DELETE` pose
                    `supprime_le`, la ligne reste en base. */}
                Archiver
              </Bouton>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
