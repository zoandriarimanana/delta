/**
 * Champs d'identité d'un client particulier.
 *
 * Extrait de la page d'inscription : les deux blocs d'identité y sont
 * interchangeables, et les garder en ligne aurait fait un composant dont la
 * moitié des champs sont inertes selon le type choisi — le défaut que la
 * séparation des formulaires de réservation évitait déjà.
 */

import type { IdentiteParticulier } from '../auth.types';

interface Proprietes {
  valeurs: IdentiteParticulier;
  surChangement: (valeurs: IdentiteParticulier) => void;
}

export default function ChampsParticulier({ valeurs, surChangement }: Proprietes) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Nom
        <input
          type="text"
          required
          value={valeurs.nom}
          onChange={(evenement) =>
            surChangement({ ...valeurs, nom: evenement.target.value })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Prénom
        <input
          type="text"
          required
          value={valeurs.prenom}
          onChange={(evenement) =>
            surChangement({ ...valeurs, prenom: evenement.target.value })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Date de naissance <span className="text-slate-500">(facultative)</span>
        <input
          type="date"
          value={valeurs.date_naissance ?? ''}
          onChange={(evenement) =>
            surChangement({
              ...valeurs,
              // Une chaîne vide n'est pas une date : on retire la clé plutôt
              // que d'envoyer `""`, que le serveur refuserait en 422.
              date_naissance: evenement.target.value || undefined,
            })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
    </>
  );
}
