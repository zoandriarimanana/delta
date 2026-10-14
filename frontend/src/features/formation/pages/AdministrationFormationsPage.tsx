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
import { Plus } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';
import SelecteurPhotos from '@/features/galerie/components/SelecteurPhotos';
import { usePhotosCreation } from '@/features/galerie/galerie.hooks';

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
  const photos = usePhotosCreation();
  const { reinitialiser: oublierPhotos } = photos;
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setErreur(null);
    oublierPhotos();
  }, [oublierPhotos]);

  // Les archives sont masquées par défaut : elles ne font pas partie du
  // travail courant, et les afficher toujours noierait le catalogue actif.
  const visibles = catalogue.formations.filter(
    (formation) => avecArchives || !estArchive(formation)
  );
  const nombreArchives = catalogue.formations.filter(estArchive).length;

  async function creer(donnees: FormationEnvoyee) {
    if (edition.mode === 'creation' && photos.manquantes !== null) {
      setErreur(photos.manquantes);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const formation = await creerFormation(donnees);
      await photos.envoyer({ formation: formation.id_formation });
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
        <h1 className="text-2xl font-semibold text-gris-700">
          Administration des formations
        </h1>
        <div className="flex items-center gap-3">
          <Link
            to="/personnel/domaines-formation"
            className="text-sm text-primaire underline"
          >
            Gérer les domaines
          </Link>
          {edition.mode === 'ferme' && (
            <Bouton
              variante="primaire"
              icone={Plus}
              onClick={() => setEdition({ mode: 'creation' })}
            >
              Nouvelle formation
            </Bouton>
          )}
        </div>
      </div>

      {photos.avertissement !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-attente/30 bg-attente/10 p-3 text-sm text-gris-700"
        >
          {photos.avertissement}
        </p>
      )}

      {catalogue.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {catalogue.erreur}
        </p>
      )}

      {edition.mode !== 'ferme' && (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <h2 className="mb-4 text-lg font-medium text-gris-700">Nouvelle formation</h2>
          {edition.mode === 'creation' && (
            <SelecteurPhotos
              fichiers={photos.fichiers}
              surChange={photos.setFichiers}
            />
          )}
          <FormulaireFormation
            domaines={domaines.domaines}
            envoi={envoi}
            erreur={erreur}
            surEnvoi={(donnees) => void creer(donnees)}
            surAnnulation={fermer}
          />
        </div>
      )}

      <label className="mt-6 flex items-center gap-2 text-sm text-gris-700">
        <input
          type="checkbox"
          checked={avecArchives}
          onChange={(evenement) => setAvecArchives(evenement.target.checked)}
        />
        Afficher les archives ({nombreArchives})
      </label>

      {catalogue.chargement && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      {!catalogue.chargement && visibles.length === 0 && (
        <p className="mt-6 text-gris-600">Aucune formation à afficher.</p>
      )}

      {visibles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-surface shadow-sm">
            <thead>
              <tr className="border-b border-gris-200 text-left">
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Titre</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Domaine</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Prix</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">État</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-200">
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
