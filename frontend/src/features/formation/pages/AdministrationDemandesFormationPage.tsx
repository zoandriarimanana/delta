/**
 * Demandes de formation sur commande — administration (14 octobre 2026).
 *
 * Les plus récentes d'abord, filtrables par avancement. Une demande
 * planifiée se monte ensuite par les écrans existants du catalogue
 * (« Domaines », « Formations ») : cet écran ne crée rien lui-même.
 */

import { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';

import CarteDemandeFormation from '../components/CarteDemandeFormation';
import {
  LIBELLES_STATUT_DEMANDE,
  useDemandesFormationAdministration,
} from '../demandeFormation.administration';
import type { StatutDemandeFormation } from '../demandeFormation.types';

const FILTRES: (StatutDemandeFormation | '')[] = [
  '',
  'Nouvelle',
  'En_discussion',
  'Planifiee',
  'Refusee',
];

export default function AdministrationDemandesFormationPage() {
  const donnees = useDemandesFormationAdministration();
  const [filtre, setFiltre] = useState<StatutDemandeFormation | ''>('');

  const compte = useMemo(() => {
    const total: Record<string, number> = { '': donnees.demandes.length };
    for (const d of donnees.demandes) total[d.statut] = (total[d.statut] ?? 0) + 1;
    return total;
  }, [donnees.demandes]);
  const affichees = donnees.demandes.filter(
    (d) => filtre === '' || d.statut === filtre
  );

  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
          <GraduationCap size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gris-700">
            Demandes de formation
          </h1>
          <p className="mt-0.5 text-sm text-gris-500">
            Formations demandées par des visiteurs et absentes du catalogue, les plus
            récentes d’abord. Rappelez le demandeur, suivez l’avancement, puis montez la
            formation depuis « Formations ».
          </p>
        </div>
      </div>

      <div
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filtrer par avancement"
      >
        {FILTRES.map((f) => (
          <button
            key={f || 'toutes'}
            type="button"
            role="tab"
            aria-selected={filtre === f}
            onClick={() => setFiltre(f)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              filtre === f
                ? 'border-primaire bg-primaire text-sur-couleur'
                : 'border-gris-300 text-gris-600 hover:border-primaire'
            }`}
          >
            {f === '' ? 'Toutes' : LIBELLES_STATUT_DEMANDE[f]} {compte[f] ?? 0}
          </button>
        ))}
      </div>

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {donnees.erreur}
        </p>
      )}
      {donnees.chargement && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}
      {!donnees.chargement && affichees.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-gris-300 bg-surface p-8 text-center text-gris-500">
          Aucune demande à afficher.
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {affichees.map((demande) => (
          <CarteDemandeFormation
            key={`${demande.id_demande}-${demande.statut}-${demande.note_interne ?? ''}`}
            demande={demande}
            enCours={donnees.idEnCours === demande.id_demande}
            surSuivre={(statut, note) =>
              void donnees.suivre(demande.id_demande, statut, note)
            }
            surArchiver={() => void donnees.archiver(demande.id_demande)}
          />
        ))}
      </ul>
    </section>
  );
}
