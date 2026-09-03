/**
 * Administration des catégories produit.
 *
 * Plus simple que l'écran produit : un libellé, unique parmi les **actives**.
 * L'unicité est un index **partiel**, ce qui a deux conséquences visibles ici.
 *
 * Archiver une catégorie libère son libellé : on peut en recréer une du même
 * nom. Mais restaurer l'ancienne devient alors impossible — la base refuserait
 * deux catégories actives homonymes, et l'API répond **409**. C'est la
 * différence avec le produit, dont la restauration ne peut jamais échouer.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import {
  estArchive,
  messageDAdministration,
  useActionsCatalogue,
  useCatalogueAdministration,
} from '../produit.administration';
import { creerCategorie, modifierCategorie } from '../produit.api';
import type { CategorieProduitAdministration } from '../produit.types';

export default function AdministrationCategoriesPage() {
  const catalogue = useCatalogueAdministration();
  const actions = useActionsCatalogue(catalogue.recharger);
  const [libelle, setLibelle] = useState('');
  const [enEdition, setEnEdition] = useState<CategorieProduitAdministration | null>(
    null
  );
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const reinitialiser = useCallback(() => {
    setLibelle('');
    setEnEdition(null);
    setErreur(null);
  }, []);

  const visibles = catalogue.categories.filter(
    (categorie) => avecArchives || !estArchive(categorie)
  );
  const nombreArchives = catalogue.categories.filter(estArchive).length;

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      if (enEdition !== null) {
        await modifierCategorie(enEdition.id_categorie, { libelle });
      } else {
        await creerCategorie({ libelle });
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
        <h1 className="text-2xl font-semibold text-warm-gray-700">Catégories</h1>
        <Link to="/personnel/catalogue" className="text-sm text-terracotta underline">
          Retour au catalogue
        </Link>
      </div>

      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void enregistrer();
        }}
      >
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
        <Bouton type="submit" disabled={envoi || libelle.trim() === ''}>
          {enEdition !== null ? 'Enregistrer' : 'Ajouter'}
        </Bouton>
        {enEdition !== null && (
          <Bouton variante="secondaire" onClick={reinitialiser}>
            Annuler
          </Bouton>
        )}
      </form>

      {[erreur, actions.erreur, catalogue.erreur].map(
        (message, index) =>
          message !== null && (
            // Repris tel quel : « Cette catégorie contient encore des produits »
            // ou « Une catégorie active porte déjà ce libellé » disent quoi
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
        {visibles.map((categorie) => {
          const archive = estArchive(categorie);
          return (
            <li
              key={categorie.id_categorie}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warm-gray-200 bg-white p-3 ${
                archive ? 'bg-warm-gray-100/60' : ''
              }`}
            >
              <span className="flex items-center gap-3 text-sm text-warm-gray-700">
                {categorie.libelle}
                <Badge variante={archive ? 'negatif' : 'positif'}>
                  {archive ? 'Archivée' : 'Active'}
                </Badge>
              </span>

              <span className="flex gap-2">
                {archive ? (
                  <Bouton
                    variante="secondaire"
                    disabled={actions.envoi}
                    onClick={() =>
                      void actions.restaurerLaCategorie(categorie.id_categorie)
                    }
                  >
                    Restaurer
                  </Bouton>
                ) : (
                  <>
                    <Bouton
                      variante="secondaire"
                      disabled={actions.envoi}
                      onClick={() => {
                        setEnEdition(categorie);
                        setLibelle(categorie.libelle);
                      }}
                    >
                      Renommer
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      disabled={actions.envoi}
                      onClick={() =>
                        void actions.archiverLaCategorie(categorie.id_categorie)
                      }
                    >
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
