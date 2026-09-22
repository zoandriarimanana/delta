/**
 * Administration du catalogue des logements.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur. Un frontend est du code exécuté chez l'utilisateur.
 *
 * **Aucun droit n'est masqué ici.** `est_administrateur` n'est lisible nulle
 * part côté client : un salarié sans droit voit l'écran et reçoit un **403**
 * à la première écriture.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, on n'y contemple
 * pas des logements. C'est ce qui distingue cet écran du catalogue public
 * (`LogementListPage`). Même patron que `AdministrationSallesPage` — pas de
 * fiche séparée, `LOGEMENT` n'a pas de sous-entité.
 */

import { useCallback, useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import FormulaireLogement from '../components/FormulaireLogement';
import LigneLogementAdministration from '../components/LigneLogementAdministration';
import { creerLogement, modifierLogement } from '../logement.api';
import {
  estArchive,
  messageDAdministration,
  useActionsLogements,
  useLogementsAdministration,
} from '../logement.administration';
import type { LogementAdministration, LogementModifie } from '../logement.types';

type Edition =
  | { mode: 'ferme' }
  | { mode: 'creation' }
  | { mode: 'modification'; logement: LogementAdministration };

export default function AdministrationLogementsPage() {
  const catalogue = useLogementsAdministration();
  const actions = useActionsLogements(catalogue.recharger);
  const [edition, setEdition] = useState<Edition>({ mode: 'ferme' });
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoiFormulaire, setEnvoiFormulaire] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setErreurFormulaire(null);
  }, []);

  // Les archives sont masquées par défaut : elles ne font pas partie du
  // travail courant, et les afficher toujours noierait le catalogue actif.
  const visibles = catalogue.logements.filter(
    (logement) => avecArchives || !estArchive(logement)
  );
  const nombreArchives = catalogue.logements.filter(estArchive).length;

  async function enregistrer(donnees: LogementModifie) {
    setEnvoiFormulaire(true);
    setErreurFormulaire(null);
    try {
      if (edition.mode === 'modification') {
        await modifierLogement(edition.logement.id_logement, donnees);
      } else {
        await creerLogement({
          type_chambre: donnees.type_chambre ?? '',
          capacite: donnees.capacite ?? 1,
          tarif_nuitee: donnees.tarif_nuitee ?? '0.00',
        });
      }
      catalogue.recharger();
      fermer();
    } catch (erreur) {
      setErreurFormulaire(messageDAdministration(erreur));
    } finally {
      setEnvoiFormulaire(false);
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-warm-gray-700">
        Administration des logements
      </h1>

      {catalogue.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {catalogue.erreur}
        </p>
      )}

      {actions.erreur !== null && (
        // Repris tel quel : « Ce logement porte encore des réservations
        // actives » dit quoi corriger.
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {actions.erreur}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-warm-gray-700">
          <input
            type="checkbox"
            checked={avecArchives}
            onChange={(evenement) => setAvecArchives(evenement.target.checked)}
          />
          Afficher les archives ({nombreArchives})
        </label>

        {edition.mode === 'ferme' && (
          <Bouton onClick={() => setEdition({ mode: 'creation' })}>
            Nouveau logement
          </Bouton>
        )}
      </div>

      {edition.mode !== 'ferme' && (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            {edition.mode === 'creation' ? 'Nouveau logement' : 'Modifier le logement'}
          </h2>
          <FormulaireLogement
            logement={edition.mode === 'modification' ? edition.logement : undefined}
            envoi={envoiFormulaire}
            erreur={erreurFormulaire}
            surEnvoi={(donnees) => void enregistrer(donnees)}
            surAnnulation={fermer}
          />
        </div>
      )}

      {catalogue.chargement && (
        <p role="status" className="mt-6 text-warm-gray-500">
          Chargement…
        </p>
      )}

      {!catalogue.chargement && visibles.length === 0 && (
        <p className="mt-6 text-warm-gray-600">Aucun logement à afficher.</p>
      )}

      {visibles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="border-b border-warm-gray-200 text-left">
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Type
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Capacité
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Tarif
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Statut
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  État
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-gray-200">
              {visibles.map((logement) => (
                <LigneLogementAdministration
                  key={logement.id_logement}
                  logement={logement}
                  envoi={actions.envoi}
                  surModification={(l) =>
                    setEdition({ mode: 'modification', logement: l })
                  }
                  surArchivage={(id) => void actions.archiverLeLogement(id)}
                  surRestauration={(id) => void actions.restaurerLeLogement(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
