/**
 * Administration du catalogue des salles.
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
 * pas des salles. C'est ce qui distingue cet écran du catalogue public
 * (`SalleListPage`). Même patron que `AdministrationProduitsPage` — pas de
 * fiche séparée, `SALLE` n'a pas de sous-entité comme `FORMATION`.
 */

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';
import SelecteurPhotos from '@/features/galerie/components/SelecteurPhotos';
import { usePhotosCreation } from '@/features/galerie/galerie.hooks';

import FormulaireSalle from '../components/FormulaireSalle';
import LigneSalleAdministration from '../components/LigneSalleAdministration';
import { creerSalle, modifierSalle } from '../salle.api';
import {
  estArchive,
  messageDAdministration,
  useActionsSalles,
  useSallesAdministration,
} from '../salle.administration';
import type { SalleAdministration, SalleEnvoyee } from '../salle.types';

type Edition =
  | { mode: 'ferme' }
  | { mode: 'creation' }
  | { mode: 'modification'; salle: SalleAdministration };

export default function AdministrationSallesPage() {
  const catalogue = useSallesAdministration();
  const actions = useActionsSalles(catalogue.recharger);
  const [edition, setEdition] = useState<Edition>({ mode: 'ferme' });
  const photos = usePhotosCreation();
  const { reinitialiser: oublierPhotos } = photos;
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoiFormulaire, setEnvoiFormulaire] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setErreurFormulaire(null);
    oublierPhotos();
  }, [oublierPhotos]);

  // Les archives sont masquées par défaut : elles ne font pas partie du
  // travail courant, et les afficher toujours noierait le catalogue actif.
  const visibles = catalogue.salles.filter(
    (salle) => avecArchives || !estArchive(salle)
  );
  const nombreArchives = catalogue.salles.filter(estArchive).length;

  async function enregistrer(donnees: SalleEnvoyee) {
    if (edition.mode === 'creation' && photos.manquantes !== null) {
      setErreurFormulaire(photos.manquantes);
      return;
    }
    setEnvoiFormulaire(true);
    setErreurFormulaire(null);
    try {
      if (edition.mode === 'modification') {
        await modifierSalle(edition.salle.id_salle, donnees);
      } else {
        const salle = await creerSalle(donnees);
        await photos.envoyer({ salle: salle.id_salle });
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
      <h1 className="text-2xl font-semibold text-gris-700">
        Administration des salles
      </h1>

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

      {actions.erreur !== null && (
        // Repris tel quel : « Cette salle porte encore des réservations
        // actives » dit quoi corriger.
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {actions.erreur}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gris-700">
          <input
            type="checkbox"
            checked={avecArchives}
            onChange={(evenement) => setAvecArchives(evenement.target.checked)}
          />
          Afficher les archives ({nombreArchives})
        </label>

        {edition.mode === 'ferme' && (
          <Bouton
            variante="primaire"
            icone={Plus}
            onClick={() => setEdition({ mode: 'creation' })}
          >
            Nouvelle salle
          </Bouton>
        )}
      </div>

      {edition.mode !== 'ferme' && (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <h2 className="mb-4 text-lg font-medium text-gris-700">
            {edition.mode === 'creation' ? 'Nouvelle salle' : 'Modifier la salle'}
          </h2>
          {edition.mode === 'creation' && (
            <SelecteurPhotos
              fichiers={photos.fichiers}
              surChange={photos.setFichiers}
            />
          )}
          <FormulaireSalle
            salle={edition.mode === 'modification' ? edition.salle : undefined}
            envoi={envoiFormulaire}
            erreur={erreurFormulaire}
            surEnvoi={(donnees) => void enregistrer(donnees)}
            surAnnulation={fermer}
          />
        </div>
      )}

      {catalogue.chargement && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      {!catalogue.chargement && visibles.length === 0 && (
        <p className="mt-6 text-gris-600">Aucune salle à afficher.</p>
      )}

      {visibles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-surface shadow-sm">
            <thead>
              <tr className="border-b border-gris-200 text-left">
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Nom</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">
                  Capacité
                </th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Tarif</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">État</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-200">
              {visibles.map((salle) => (
                <LigneSalleAdministration
                  key={salle.id_salle}
                  salle={salle}
                  envoi={actions.envoi}
                  surModification={(s) =>
                    setEdition({ mode: 'modification', salle: s })
                  }
                  surArchivage={(id) => void actions.archiverLaSalle(id)}
                  surRestauration={(id) => void actions.restaurerLaSalle(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
