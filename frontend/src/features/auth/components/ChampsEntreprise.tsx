/**
 * Champs d'identité d'un client entreprise.
 *
 * `numero_id_fiscal` est **unique en base** : deux entreprises ne peuvent pas
 * le partager, et le refus correspondant est un 409 distinct de celui portant
 * sur l'e-mail. Les deux ne se corrigent pas de la même façon, d'où l'intérêt
 * de reprendre le message du serveur tel quel.
 *
 * `pays` (ouverture internationale) : une société étrangère porte dans
 * `numero_id_fiscal` son identifiant fiscal national (n° de TVA, EIN…).
 */

import { useMemo } from 'react';

import { listePays } from '@/lib/pays';

import type { IdentiteEntreprise } from '../auth.types';

interface Proprietes {
  valeurs: IdentiteEntreprise;
  surChangement: (valeurs: IdentiteEntreprise) => void;
}

export default function ChampsEntreprise({ valeurs, surChangement }: Proprietes) {
  const pays = useMemo(() => listePays(), []);
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-gris-700">
        Pays
        <select
          required
          value={valeurs.pays ?? 'MG'}
          onChange={(evenement) =>
            surChangement({ ...valeurs, pays: evenement.target.value })
          }
          className="rounded border border-gris-300 px-2 py-1"
        >
          {pays.map(({ code, nom }) => (
            <option key={code} value={code}>
              {nom}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gris-700">
        Raison sociale
        <input
          type="text"
          required
          value={valeurs.raison_sociale}
          onChange={(evenement) =>
            surChangement({ ...valeurs, raison_sociale: evenement.target.value })
          }
          className="rounded border border-gris-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gris-700">
        Numéro d’identification fiscale
        <span className="text-xs text-gris-500">
          NIF à Madagascar, n° de TVA ou identifiant fiscal national à l’étranger
        </span>
        <input
          type="text"
          required
          value={valeurs.numero_id_fiscal}
          onChange={(evenement) =>
            surChangement({ ...valeurs, numero_id_fiscal: evenement.target.value })
          }
          className="rounded border border-gris-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gris-700">
        Secteur d’activité <span className="text-gris-500">(facultatif)</span>
        <input
          type="text"
          value={valeurs.secteur_activite ?? ''}
          onChange={(evenement) =>
            surChangement({
              ...valeurs,
              secteur_activite: evenement.target.value || undefined,
            })
          }
          className="rounded border border-gris-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gris-700">
        Contact référent <span className="text-gris-500">(facultatif)</span>
        <input
          type="text"
          value={valeurs.nom_contact_referent ?? ''}
          onChange={(evenement) =>
            surChangement({
              ...valeurs,
              nom_contact_referent: evenement.target.value || undefined,
            })
          }
          className="rounded border border-gris-300 px-2 py-1"
        />
      </label>
    </>
  );
}
