/**
 * Administration des domaines de formation.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur. Un frontend est du code exécuté chez l'utilisateur.
 *
 * **Aucun droit n'est masqué ici.** `est_administrateur` n'est lisible nulle
 * part côté client : un salarié sans droit voit l'écran et reçoit un **403**
 * à la première écriture.
 *
 * Même patron que `AdministrationCategoriesPage` (produit/catégorie) : un
 * libellé unique parmi les actives, formulaire inline, pas de fiche séparée —
 * `DOMAINE_FORMATION` a la même simplicité structurelle que
 * `CATEGORIE_PRODUIT`. Le champ `description` en plus est la seule
 * différence avec ce patron.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import { creerDomaine, modifierDomaine } from '../formation.api';
import {
  estArchive,
  messageDAdministration,
  useActionsDomaines,
  useDomainesAdministration,
} from '../formation.administration';
import type { DomaineFormationAdministration } from '../formation.types';

export default function AdministrationDomainesPage() {
  const catalogue = useDomainesAdministration();
  const actions = useActionsDomaines(catalogue.recharger);
  const [libelle, setLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [enEdition, setEnEdition] = useState<DomaineFormationAdministration | null>(
    null
  );
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const reinitialiser = useCallback(() => {
    setLibelle('');
    setDescription('');
    setEnEdition(null);
    setErreur(null);
  }, []);

  // Les archives sont masquées par défaut : elles ne font pas partie du
  // travail courant, et les afficher toujours noierait le catalogue actif.
  const visibles = catalogue.domaines.filter(
    (domaine) => avecArchives || !estArchive(domaine)
  );
  const nombreArchives = catalogue.domaines.filter(estArchive).length;

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const donnees = { libelle, description: description === '' ? null : description };
      if (enEdition !== null) {
        await modifierDomaine(enEdition.id_domaine, donnees);
      } else {
        await creerDomaine(donnees);
      }
      catalogue.recharger();
      reinitialiser();
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
          Domaines de formation
        </h1>
        <Link to="/personnel/formations" className="text-sm text-terracotta underline">
          Retour aux formations
        </Link>
      </div>

      <form
        className="mt-6 space-y-3"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void enregistrer();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
            Libellé
            <input
              type="text"
              required
              value={libelle}
              onChange={(evenement) => setLibelle(evenement.target.value)}
              className="rounded border border-warm-gray-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
            Description <span className="text-warm-gray-500">(facultative)</span>
            <input
              type="text"
              value={description}
              onChange={(evenement) => setDescription(evenement.target.value)}
              className="rounded border border-warm-gray-300 px-2 py-1"
            />
          </label>
          <Bouton type="submit" disabled={envoi || libelle.trim() === ''}>
            {enEdition !== null ? 'Enregistrer' : 'Ajouter'}
          </Bouton>
          {enEdition !== null && (
            <Bouton variante="secondaire" onClick={reinitialiser}>
              Annuler
            </Bouton>
          )}
        </div>
      </form>

      {[erreur, actions.erreur, catalogue.erreur].map(
        (message, index) =>
          message !== null && (
            // Repris tel quel : « Ce domaine contient encore des formations »
            // ou « Un domaine actif porte déjà ce libellé » disent quoi
            // corriger. Un message générique le ferait perdre.
            <p
              key={index}
              role="alert"
              className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
            >
              {message}
            </p>
          )
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
        <p role="status" className="mt-4 text-warm-gray-500">
          Chargement…
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {visibles.map((domaine) => {
          const archive = estArchive(domaine);
          return (
            <li
              key={domaine.id_domaine}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warm-gray-200 bg-white p-3 ${
                archive ? 'bg-warm-gray-100/60' : ''
              }`}
            >
              <span className="flex flex-col gap-1 text-sm text-warm-gray-700">
                <span className="flex items-center gap-3">
                  {domaine.libelle}
                  <Badge variante={archive ? 'negatif' : 'positif'}>
                    {archive ? 'Archivé' : 'Actif'}
                  </Badge>
                </span>
                {domaine.description !== null && (
                  <span className="text-xs text-warm-gray-500">
                    {domaine.description}
                  </span>
                )}
              </span>

              <span className="flex gap-2">
                {archive ? (
                  <Bouton
                    variante="secondaire"
                    disabled={actions.envoi}
                    onClick={() => void actions.restaurerLeDomaine(domaine.id_domaine)}
                  >
                    Restaurer
                  </Bouton>
                ) : (
                  <>
                    <Bouton
                      variante="secondaire"
                      disabled={actions.envoi}
                      onClick={() => {
                        setEnEdition(domaine);
                        setLibelle(domaine.libelle);
                        setDescription(domaine.description ?? '');
                      }}
                    >
                      Modifier
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      disabled={actions.envoi}
                      onClick={() => void actions.archiverLeDomaine(domaine.id_domaine)}
                    >
                      {/* « Archiver » et non « Supprimer » : `DELETE` pose
                          `supprime_le`, la ligne reste en base. */}
                      Archiver
                    </Bouton>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
