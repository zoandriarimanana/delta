/**
 * Une ligne du tableau d'administration des produits.
 *
 * Extraite pour que la page reste lisible : elle porte l'état archivé, les
 * actions, et rien d'autre.
 */

import { Link } from 'react-router';

import Badge from '@/components/ui/Badge';
import { Archive, Pencil, RotateCcw } from 'lucide-react';
import Bouton from '@/components/ui/Bouton';
import {
  CLASSES_LIGNE_CLIQUABLE,
  useNavigationAuClic,
} from '@/lib/useNavigationAuClic';

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
  const naviguerAuClic = useNavigationAuClic();
  const fiche = `/personnel/catalogue/${produit.id_produit}`;
  const categorie = categories.find((c) => c.id_categorie === produit.id_categorie);

  return (
    <tr
      onClick={naviguerAuClic(fiche)}
      className={`${archive ? 'bg-gris-100/60' : ''} ${CLASSES_LIGNE_CLIQUABLE}`}
    >
      <td className="px-3 py-2 text-sm">
        <Link to={fiche} className="text-gris-700 hover:underline">
          {produit.nom}
        </Link>
      </td>
      <td className="px-3 py-2 text-sm text-gris-600">{categorie?.libelle ?? '—'}</td>
      <td className="px-3 py-2 text-sm text-gris-700">{formaterPrix(produit)}</td>
      <td className="px-3 py-2 text-sm text-gris-700">{produit.stock_disponible}</td>
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
              variante="valider"
              icone={RotateCcw}
              disabled={envoi}
              onClick={() => surRestauration(produit.id_produit)}
            >
              Restaurer
            </Bouton>
          ) : (
            <>
              <Bouton
                variante="secondaire"
                icone={Pencil}
                disabled={envoi}
                onClick={() => surModification(produit)}
              >
                Modifier
              </Bouton>
              <Bouton
                variante="danger-contour"
                icone={Archive}
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
