/** Une formation dans le catalogue. */

import { Link } from 'react-router';

import Carte from '@/components/ui/Carte';
import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { imageFormation } from '@/lib/images';
import { useTextes } from '@/lib/langue';

import { TEXTES_FORMATION } from '../formation.textes';
import { formaterDuree } from '../formation.service';
import type { Formation } from '../formation.types';

export default function CarteFormation({ formation }: { formation: Formation }) {
  const t = useTextes(TEXTES_FORMATION);
  const prix = useFormaterPrix();
  return (
    <Link to={`/formations/${formation.id_formation}`} className="no-underline">
      <Carte
        image={imageFormation(formation.id_formation)}
        titre={formation.titre}
        description={`${formaterDuree(formation.duree_heures)}${formation.niveau ? ` • ${t.niveau(formation.niveau)}` : ''}`}
        pied={
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-primaire">
              {prix(formation.prix)}
            </span>
            {formation.propose_hebergement && (
              <span className="text-xs bg-succes/15 text-succes px-2 py-1 rounded-full">
                {t.hebergement}
              </span>
            )}
          </div>
        }
      />
    </Link>
  );
}
