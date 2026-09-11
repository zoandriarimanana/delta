/**
 * Une ligne du tableau d'administration des salles.
 *
 * Extraite pour que la page reste lisible : elle porte la vignette, l'état
 * archivé, les actions, et rien d'autre. Même patron que
 * `LigneProduitAdministration`.
 */

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import { imagePour } from '@/lib/images';

import { estArchive } from '../salle.administration';
import { libelleTarif } from '../salle.service';
import type { SalleAdministration } from '../salle.types';

interface Proprietes {
  salle: SalleAdministration;
  envoi: boolean;
  surModification: (salle: SalleAdministration) => void;
  surArchivage: (idSalle: number) => void;
  surRestauration: (idSalle: number) => void;
}

export default function LigneSalleAdministration({
  salle,
  envoi,
  surModification,
  surArchivage,
  surRestauration,
}: Proprietes) {
  const archive = estArchive(salle);

  return (
    <tr className={archive ? 'bg-warm-gray-100/60' : undefined}>
      <td className="px-3 py-2">
        <img
          src={imagePour('salle', salle.id_salle)}
          alt=""
          className="h-12 w-12 rounded object-cover"
        />
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">{salle.nom}</td>
      <td className="px-3 py-2 text-sm text-warm-gray-600">{salle.capacite} pers.</td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">{libelleTarif(salle)}</td>
      <td className="px-3 py-2">
        {/* Le libellé et la variante viennent d'ici, pas de la pastille : elle
            ne connaît aucune entité. */}
        <Badge variante={archive ? 'negatif' : 'positif'}>
          {archive ? 'Archivée' : 'Active'}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          {archive ? (
            <Bouton
              variante="secondaire"
              disabled={envoi}
              onClick={() => surRestauration(salle.id_salle)}
            >
              Restaurer
            </Bouton>
          ) : (
            <>
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => surModification(salle)}
              >
                Modifier
              </Bouton>
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => surArchivage(salle.id_salle)}
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
