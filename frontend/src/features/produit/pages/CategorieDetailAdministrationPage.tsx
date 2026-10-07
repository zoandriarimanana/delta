/**
 * Fiche d'une catégorie de produits, administration.
 *
 * Son contenu utile est la liste de **ses produits**, actifs et archivés —
 * c'est aussi ce qui explique un refus d'archivage (« la catégorie contient
 * encore des produits »). Chaque produit mène à sa propre fiche.
 */

import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import {
  CLASSES_LIGNE_CLIQUABLE,
  useNavigationAuClic,
} from '@/lib/useNavigationAuClic';

import {
  estArchive,
  messageDAdministration,
  useActionsCatalogue,
  useCatalogueAdministration,
} from '../produit.administration';
import { modifierCategorie } from '../produit.api';
import { formaterPrix } from '../produit.service';

const CLASSES_ALERTE =
  'rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger';

export default function CategorieDetailAdministrationPage() {
  const { idCategorie } = useParams<{ idCategorie: string }>();
  const id = Number(idCategorie);

  const catalogue = useCatalogueAdministration();
  const actions = useActionsCatalogue(catalogue.recharger);
  const naviguerAuClic = useNavigationAuClic();
  const [libelle, setLibelle] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const categorie = catalogue.categories.find((c) => c.id_categorie === id) ?? null;

  async function renommer(evenement: FormEvent) {
    evenement.preventDefault();
    if (libelle === null || libelle.trim() === '') return;
    setEnvoi(true);
    setErreurEdition(null);
    try {
      await modifierCategorie(id, { libelle: libelle.trim() });
      catalogue.recharger();
      setLibelle(null);
    } catch (erreur) {
      setErreurEdition(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (catalogue.chargement && categorie === null) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }

  if (categorie === null) {
    return (
      <p role="alert" className={CLASSES_ALERTE}>
        {catalogue.erreur ?? 'Catégorie introuvable.'}
      </p>
    );
  }

  const archive = estArchive(categorie);
  const produits = catalogue.produits
    .filter((p) => p.id_categorie === id)
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const actifs = produits.filter((p) => !estArchive(p)).length;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gris-700">{categorie.libelle}</h1>
          <Badge variante={archive ? 'negatif' : 'positif'}>
            {archive ? 'Archivée' : 'Active'}
          </Badge>
        </div>
        <Link to="/personnel/categories" className="text-sm text-primaire underline">
          Retour à la liste
        </Link>
      </div>

      {actions.erreur !== null && (
        <p role="alert" className={`mt-4 ${CLASSES_ALERTE}`}>
          {actions.erreur}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
        <p className="text-sm text-gris-600">
          {produits.length} produit(s) dans cette catégorie, dont {actifs} actif(s).
        </p>

        {libelle !== null ? (
          <form
            onSubmit={(e) => void renommer(e)}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <label className="flex flex-col gap-1 text-sm text-gris-700">
              Libellé
              <input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                required
                className="rounded border border-gris-300 px-2 py-1.5"
              />
            </label>
            <Bouton type="submit" disabled={envoi}>
              Enregistrer
            </Bouton>
            <Bouton
              variante="secondaire"
              onClick={() => {
                setLibelle(null);
                setErreurEdition(null);
              }}
            >
              Annuler
            </Bouton>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {archive ? (
              <Bouton
                variante="secondaire"
                disabled={actions.envoi}
                onClick={() => void actions.restaurerLaCategorie(id)}
              >
                Restaurer
              </Bouton>
            ) : (
              <>
                <Bouton
                  variante="secondaire"
                  onClick={() => setLibelle(categorie.libelle)}
                >
                  Renommer
                </Bouton>
                <Bouton
                  variante="secondaire"
                  disabled={actions.envoi}
                  onClick={() => void actions.archiverLaCategorie(id)}
                >
                  Archiver
                </Bouton>
              </>
            )}
          </div>
        )}
        {erreurEdition !== null && (
          <p role="alert" className={`mt-3 ${CLASSES_ALERTE}`}>
            {erreurEdition}
          </p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-medium text-gris-700">
        Produits de la catégorie
      </h2>
      {produits.length === 0 ? (
        <p className="mt-2 text-sm text-gris-500">
          Aucun produit dans cette catégorie.
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse rounded-xl bg-surface shadow-sm">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2 text-sm font-medium text-gris-600">Nom</th>
              <th className="px-3 py-2 text-sm font-medium text-gris-600">Prix</th>
              <th className="px-3 py-2 text-sm font-medium text-gris-600">Stock</th>
              <th className="px-3 py-2 text-sm font-medium text-gris-600">État</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((produit) => {
              const produitArchive = estArchive(produit);
              return (
                <tr
                  key={produit.id_produit}
                  onClick={naviguerAuClic(`/personnel/catalogue/${produit.id_produit}`)}
                  className={`border-t border-gris-100 ${CLASSES_LIGNE_CLIQUABLE}`}
                >
                  <td className="px-3 py-2 text-sm">
                    <Link
                      to={`/personnel/catalogue/${produit.id_produit}`}
                      className="text-gris-700 hover:underline"
                    >
                      {produit.nom}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-gris-700">
                    {formaterPrix(produit)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gris-700">
                    {produit.stock_disponible}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variante={produitArchive ? 'negatif' : 'positif'}>
                      {produitArchive ? 'Archivé' : 'Actif'}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
