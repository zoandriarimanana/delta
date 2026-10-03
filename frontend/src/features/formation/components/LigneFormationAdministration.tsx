/**
 * Une ligne du tableau d'administration des formations.
 *
 * **Pas d'actions inline** : contrairement à `SALLE`/`LOGEMENT`/
 * `DOMAINE_FORMATION`, cette ligne ne porte qu'un lien vers la fiche — même
 * patron que `PERSONNEL`/`ABONNEMENT`, où les écritures (modifier, archiver,
 * restaurer) vivent sur `FormationDetailAdministrationPage`. Nécessaire ici
 * pour que la fiche puisse accueillir le tableau de sessions embarqué
 * (sous-tâche suivante du chantier), qu'une ligne de tableau ne pourrait pas
 * porter.
 */

import { Link } from 'react-router';

import Badge from '@/components/ui/Badge';
import { formaterMontant } from '@/features/commande/commande.service';
import { imagePour } from '@/lib/images';

import { estArchive } from '../formation.administration';
import type {
  DomaineFormationAdministration,
  FormationAdministration,
} from '../formation.types';

interface Proprietes {
  formation: FormationAdministration;
  domaines: DomaineFormationAdministration[];
}

export default function LigneFormationAdministration({
  formation,
  domaines,
}: Proprietes) {
  const archive = estArchive(formation);
  const domaine = domaines.find((d) => d.id_domaine === formation.id_domaine);

  return (
    <tr className={archive ? 'bg-warm-gray-100/60' : undefined}>
      <td className="px-3 py-2">
        <img
          src={imagePour('formation', formation.id_formation)}
          alt=""
          className="h-12 w-12 rounded object-cover"
        />
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">{formation.titre}</td>
      <td className="px-3 py-2 text-sm text-warm-gray-600">
        {domaine?.libelle ?? '—'}
      </td>
      <td className="px-3 py-2 text-sm text-warm-gray-700">
        {formaterMontant(formation.prix)}
      </td>
      <td className="px-3 py-2">
        <Badge variante={archive ? 'negatif' : 'positif'}>
          {archive ? 'Archivée' : 'Active'}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          to={`/personnel/formations/${formation.id_formation}`}
          className="text-sm text-terracotta underline"
        >
          Voir la fiche
        </Link>
      </td>
    </tr>
  );
}
