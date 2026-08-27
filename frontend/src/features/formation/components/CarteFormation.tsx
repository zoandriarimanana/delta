/** Une formation dans le catalogue. */

import { Link } from 'react-router';

import Card from '@/components/Card';
import { getFormationImage } from '@/lib/images';
import { formaterMontant } from '@/features/commande/commande.service';

import { formaterDuree } from '../formation.service';
import type { Formation } from '../formation.types';

export default function CarteFormation({ formation }: { formation: Formation }) {
  return (
    <Link to={`/formations/${formation.id_formation}`} className="no-underline">
      <Card
        image={getFormationImage(formation.titre)}
        title={formation.titre}
        description={`${formaterDuree(formation.duree_heures)}${formation.niveau ? ` • Niveau ${formation.niveau}` : ''}`}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-terracotta">
              {formaterMontant(formation.prix)}
            </span>
            {formation.propose_hebergement && (
              <span className="text-xs bg-sage/15 text-sage px-2 py-1 rounded-full">
                🏨 Hébergement
              </span>
            )}
          </div>
        }
      />
    </Link>
  );
}
