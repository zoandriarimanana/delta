/**
 * Une ligne du tableau d'administration des logements.
 *
 * Extraite pour que la page reste lisible : elle porte la vignette, l'état
 * archivé, le statut métier, les actions. Même patron que
 * `LigneSalleAdministration`.
 *
 * **Deux pastilles, pas une** : le statut métier (`Disponible` /
 * `En_maintenance` / `Hors_service`) et l'état d'archivage ne se confondent
 * pas — un logement `Hors_service` reste actif tant qu'il n'est pas archivé,
 * cf. `docs/mld.md`.
 */

import { formaterMontant } from '@/features/commande/commande.service';
import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import { imagePour } from '@/lib/images';

import { estArchive } from '../logement.administration';
import { libelleStatut, varianteStatut } from '../logement.service';
import type { LogementAdministration } from '../logement.types';

interface Proprietes {
  logement: LogementAdministration;
  envoi: boolean;
  surModification: (logement: LogementAdministration) => void;
  surArchivage: (idLogement: number) => void;
  surRestauration: (idLogement: number) => void;
}

export default function LigneLogementAdministration({
  logement,
  envoi,
  surModification,
  surArchivage,
  surRestauration,
}: Proprietes) {
  const archive = estArchive(logement);

  return (
    <tr className={archive ? 'bg-warm-gray-100/60' : undefined}>
      <td className="px-3 py-2">
        <img
          src={imagePour('logement', logement.id_logement)}
          alt=""
          className="h-12 w-12 rounded object-cover"
        />
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">{logement.type_chambre}</td>
      <td className="px-3 py-2 text-sm text-warm-gray-600">
        {logement.capacite} pers.
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        {formaterMontant(logement.tarif_nuitee)} / nuit
      </td>
      <td className="px-3 py-2">
        <Badge variante={varianteStatut(logement.statut)}>
          {libelleStatut(logement.statut)}
        </Badge>
      </td>
      <td className="px-3 py-2">
        {/* Le libellé et la variante viennent d'ici, pas de la pastille :
            elle ne connaît aucune entité. */}
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
              onClick={() => surRestauration(logement.id_logement)}
            >
              Restaurer
            </Bouton>
          ) : (
            <>
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => surModification(logement)}
              >
                Modifier
              </Bouton>
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => surArchivage(logement.id_logement)}
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
