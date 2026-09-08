/**
 * Champs d'identité d'un client entreprise.
 *
 * `numero_id_fiscal` est **unique en base** : deux entreprises ne peuvent pas
 * le partager, et le refus correspondant est un 409 distinct de celui portant
 * sur l'e-mail. Les deux ne se corrigent pas de la même façon, d'où l'intérêt
 * de reprendre le message du serveur tel quel.
 */

import type { IdentiteEntreprise } from '../auth.types';

interface Proprietes {
  valeurs: IdentiteEntreprise;
  surChangement: (valeurs: IdentiteEntreprise) => void;
}

export default function ChampsEntreprise({ valeurs, surChangement }: Proprietes) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Raison sociale
        <input
          type="text"
          required
          value={valeurs.raison_sociale}
          onChange={(evenement) =>
            surChangement({ ...valeurs, raison_sociale: evenement.target.value })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Numéro d’identification fiscale
        <input
          type="text"
          required
          value={valeurs.numero_id_fiscal}
          onChange={(evenement) =>
            surChangement({ ...valeurs, numero_id_fiscal: evenement.target.value })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Secteur d’activité <span className="text-slate-500">(facultatif)</span>
        <input
          type="text"
          value={valeurs.secteur_activite ?? ''}
          onChange={(evenement) =>
            surChangement({
              ...valeurs,
              secteur_activite: evenement.target.value || undefined,
            })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Contact référent <span className="text-slate-500">(facultatif)</span>
        <input
          type="text"
          value={valeurs.nom_contact_referent ?? ''}
          onChange={(evenement) =>
            surChangement({
              ...valeurs,
              nom_contact_referent: evenement.target.value || undefined,
            })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
    </>
  );
}
