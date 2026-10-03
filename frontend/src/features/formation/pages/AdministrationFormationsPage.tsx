/**
 * Administration des formations — liste.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, comme
 * `AdministrationSallesPage`. **Aucune action destructive ici** : modifier,
 * archiver et restaurer vivent sur la fiche
 * (`FormationDetailAdministrationPage`), même partage que
 * `AdministrationPersonnelPage`/`PersonnelDetailAdministrationPage` — la
 * liste ne fait que créer et donner accès à la fiche.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@/components/ui/Bouton';

import FormulaireFormation from '../components/FormulaireFormation';
import LigneFormationAdministration from '../components/LigneFormationAdministration';
import { creerFormation } from '../formation.api';
import {
  estArchive,
  messageDAdministration,
  useDomainesAdministration,
  useFormationsAdministration,
} from '../formation.administration';
import type { FormationEnvoyee } from '../formation.types';

type Edition = { mode: 'ferme' } | { mode: 'creation' };

export default function AdministrationFormationsPage() {
  const catalogue = useFormationsAdministration();
  const domaines = useDomainesAdministration();
  const [edition, setEdition] = useState<Edition>({ mode: 'ferme' });
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setErreur(null);
  }, []);

  // Les archives sont masquées par défaut : elles ne font pas partie du
  // travail courant, et les afficher toujours noierait le catalogue actif.
  const visibles = catalogue.formations.filter(
    (formation) => avecArchives || !estArchive(formation)
  );
  const nombreArchives = catalogue.formations.filter(estArchive).length;

  async function creer(donnees: FormationEnvoyee) {
    setEnvoi(true);
    setErreur(null);
    try {
      await creerFormation(donnees);
      catalogue.recharger();
      fermer();
    } catch (erreurAppel) {
      setErreur(messageDAdministration(erreurAppel));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-warm-gray-700">
          Administration des formations
        </h1>
        <div className="flex items-center gap-3">
          <Link
            to="/personnel/domaines-formation"
            className="text-sm text-terracotta underline"
          >
            Gérer les domaines
          </Link>
          {edition.mode === 'ferme' && (
            <Bouton onClick={() => setEdition({ mode: 'creation' })}>
              Nouvelle formation
            </Bouton>
          )}
        </div>
      </div>

      {catalogue.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {catalogue.erreur}
        </p>
      )}

      {edition.mode !== 'ferme' && (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            Nouvelle formation
          </h2>
          <FormulaireFormation
            domaines={domaines.domaines}
            envoi={envoi}
            erreur={erreur}
            surEnvoi={(donnees) => void creer(donnees)}
            surAnnulation={fermer}
          />
        </div>
      )}

      <label className="mt-6 flex items-center gap-2 text-sm text-warm-gray-700">
        <input
          type="checkbox"
          checked={avecArchives}
          onChange={(evenement) => setAvecArchives(evenement.target.checked)}
        />
        Afficher les archives ({nombreArchives})
      </label>

      {catalogue.chargement && (
        <p role="status" className="mt-6 text-warm-gray-500">
          Chargement…
        </p>
      )}

      {!catalogue.chargement && visibles.length === 0 && (
        <p className="mt-6 text-warm-gray-600">Aucune formation à afficher.</p>
      )}

      {visibles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="border-b border-warm-gray-200 text-left">
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Titre
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Domaine
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Prix
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  État
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-gray-200">
              {visibles.map((formation) => (
                <LigneFormationAdministration
                  key={formation.id_formation}
                  formation={formation}
                  domaines={domaines.domaines}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
