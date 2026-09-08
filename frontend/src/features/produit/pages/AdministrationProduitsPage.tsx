/**
 * Administration du catalogue produit.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur. Un frontend est du code exécuté chez l'utilisateur.
 *
 * **Aucun droit n'est masqué ici.** `est_administrateur` n'est lisible nulle
 * part côté client : un salarié sans droit voit l'écran et reçoit un **403** à
 * la première écriture. C'est au message de dire qu'il lui manque un droit —
 * « une erreur est survenue » le laisserait chercher.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, on n'y contemple
 * pas des produits. C'est ce qui distingue cet écran du catalogue public.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@/components/ui/Bouton';

import FormulaireProduit from '../components/FormulaireProduit';
import LigneProduitAdministration from '../components/LigneProduitAdministration';
import {
  estArchive,
  messageDAdministration,
  useActionsCatalogue,
  useCatalogueAdministration,
} from '../produit.administration';
import { creerProduit, modifierProduit } from '../produit.api';
import type { ProduitAdministration, ProduitEnvoye } from '../produit.types';

type Edition =
  | { mode: 'ferme' }
  | { mode: 'creation' }
  | { mode: 'modification'; produit: ProduitAdministration };

export default function AdministrationProduitsPage() {
  const catalogue = useCatalogueAdministration();
  const actions = useActionsCatalogue(catalogue.recharger);
  const [edition, setEdition] = useState<Edition>({ mode: 'ferme' });
  const [avecArchives, setAvecArchives] = useState(false);
  const [envoiFormulaire, setEnvoiFormulaire] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setErreurFormulaire(null);
  }, []);

  // Les archives sont masquées par défaut : elles ne font pas partie du travail
  // courant, et les afficher toujours noierait le catalogue actif.
  const visibles = catalogue.produits.filter(
    (produit) => avecArchives || !estArchive(produit)
  );
  const nombreArchives = catalogue.produits.filter(estArchive).length;

  async function enregistrer(donnees: ProduitEnvoye) {
    setEnvoiFormulaire(true);
    setErreurFormulaire(null);
    try {
      if (edition.mode === 'modification') {
        await modifierProduit(edition.produit.id_produit, donnees);
      } else {
        await creerProduit(donnees);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-warm-gray-700">
          Administration du catalogue
        </h1>
        <Link to="/personnel/categories" className="text-sm text-terracotta underline">
          Gérer les catégories
        </Link>
      </div>

      {catalogue.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {catalogue.erreur}
        </p>
      )}

      {actions.erreur !== null && (
        // Repris tel quel : « Cette catégorie contient encore des produits » ou
        // « Une catégorie active porte déjà ce libellé » disent quoi corriger.
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
            Nouveau produit
          </Bouton>
        )}
      </div>

      {edition.mode !== 'ferme' && (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            {edition.mode === 'creation' ? 'Nouveau produit' : 'Modifier le produit'}
          </h2>
          <FormulaireProduit
            categories={catalogue.categories}
            produit={edition.mode === 'modification' ? edition.produit : undefined}
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
        <p className="mt-6 text-warm-gray-600">Aucun produit à afficher.</p>
      )}

      {visibles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="border-b border-warm-gray-200 text-left">
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Nom
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Catégorie
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Prix
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Stock
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  État
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-gray-200">
              {visibles.map((produit) => (
                <LigneProduitAdministration
                  key={produit.id_produit}
                  produit={produit}
                  categories={catalogue.categories}
                  envoi={actions.envoi}
                  surModification={(p) =>
                    setEdition({ mode: 'modification', produit: p })
                  }
                  surArchivage={(id) => void actions.archiverLeProduit(id)}
                  surRestauration={(id) => void actions.restaurerLeProduit(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
