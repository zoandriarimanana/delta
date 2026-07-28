/** Fiche d'un produit du catalogue. Publique, comme la liste. */

import { Link, useParams } from 'react-router';

import EtatRequete from '../components/EtatRequete';
import { useCategories, useProduit } from '../produit.hooks';
import { estDisponible, formaterPrix, libelleCategorie } from '../produit.service';

/**
 * Identifiant absent ou non numérique : on ne lance aucune requête.
 *
 * `Number('abc')` vaut `NaN`, qui partirait tel quel dans l'URL appelée et
 * produirait une 422 illisible côté serveur.
 */
function identifiantValide(brut: string | undefined): number | null {
  if (brut === undefined) {
    return null;
  }
  const identifiant = Number(brut);
  return Number.isInteger(identifiant) && identifiant > 0 ? identifiant : null;
}

export default function ProduitDetailPage() {
  const { idProduit } = useParams();
  const identifiant = identifiantValide(idProduit);
  // `null` désactive la requête : voir `useProduit`.
  const produit = useProduit(identifiant);
  const categories = useCategories();

  if (identifiant === null) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Produit introuvable</h1>
        <p className="mt-2 text-slate-600">Cette référence n’est pas valide.</p>
        <Lien />
      </section>
    );
  }

  return (
    <section>
      <EtatRequete chargement={produit.chargement} erreur={produit.erreur}>
        {produit.donnees !== null && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">
              {produit.donnees.nom}
            </h1>
            <p className="mt-2 text-lg text-slate-800">
              {formaterPrix(produit.donnees)}
            </p>
            {produit.donnees.description !== null && (
              <p className="mt-4 text-slate-700">{produit.donnees.description}</p>
            )}
            <dl className="mt-6 grid gap-2 text-sm text-slate-700">
              <Ligne
                terme="Disponibilité"
                valeur={
                  estDisponible(produit.donnees)
                    ? `En stock (${produit.donnees.stock_disponible})`
                    : 'Épuisé'
                }
              />
              <Ligne
                terme="Catégorie"
                valeur={
                  (categories.donnees !== null
                    ? libelleCategorie(categories.donnees, produit.donnees.id_categorie)
                    : undefined) ?? 'Non précisée'
                }
              />
              <Ligne
                terme="Personnalisable"
                valeur={produit.donnees.est_personnalisable ? 'Oui' : 'Non'}
              />
              <Ligne
                terme="Livrable"
                valeur={produit.donnees.est_livrable ? 'Oui' : 'Non'}
              />
            </dl>
          </>
        )}
      </EtatRequete>
      <Lien />
    </section>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-slate-900">{terme}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}

function Lien() {
  return (
    <Link to="/produits" className="mt-6 inline-block text-slate-900 underline">
      Retour au catalogue
    </Link>
  );
}
