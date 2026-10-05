/** Fiche d'un produit du catalogue. Publique, comme la liste. */

import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import BoutonRetour from '@/components/ui/BoutonRetour';
import NoteMoyenne from '@/components/ui/NoteMoyenne';
import { formaterMontant } from '@/features/commande/commande.service';
import { imageProduit } from '@/lib/images';

import AjoutPanierProduit from '../components/AjoutPanierProduit';
import EtatRequete from '../components/EtatRequete';
import { useCategories, useProduit } from '../produit.hooks';
import { estDisponible, formaterPrix, libelleCategorie } from '../produit.service';
import type { Produit } from '../produit.types';

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
        <LienRetour />
        <h1 className="mt-6 text-2xl font-semibold text-warm-gray-700">
          Produit introuvable
        </h1>
        <p className="mt-2 text-warm-gray-500">Cette référence n’est pas valide.</p>
      </section>
    );
  }

  const categorie =
    produit.donnees !== null && categories.donnees !== null
      ? libelleCategorie(categories.donnees, produit.donnees.id_categorie)
      : undefined;

  return (
    <section>
      <LienRetour />
      <EtatRequete chargement={produit.chargement} erreur={produit.erreur}>
        {produit.donnees !== null && (
          <Fiche produit={produit.donnees} categorie={categorie} />
        )}
      </EtatRequete>
    </section>
  );
}

function Fiche({
  produit,
  categorie,
}: {
  produit: Produit;
  categorie: string | undefined;
}) {
  const disponible = estDisponible(produit);

  return (
    <article className="mt-6 grid gap-8 md:grid-cols-2">
      <div className="overflow-hidden rounded-2xl bg-warm-gray-200 shadow-md">
        {/* Illustration d'ambiance (cf. `lib/images.ts`), pas une photo
            propre au produit : `alt` vide, le nom est lu juste à côté. */}
        <img
          src={imageProduit(produit.id_produit, produit.nom, 900)}
          alt=""
          className="aspect-[4/3] h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracotta">
            {categorie ?? 'Catégorie non précisée'}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-warm-gray-700">
            {produit.nom}
          </h1>
          <div className="mt-2">
            <NoteMoyenne moyenne={produit.note_moyenne} nombre={produit.nombre_avis} />
          </div>
        </div>

        <p className="text-2xl font-bold text-terracotta">{formaterPrix(produit)}</p>

        {/* Le module choisit ses libellés et ses variantes : la pastille ne
            connaît ni le stock ni la livraison. */}
        <ul aria-label="Statuts du produit" className="flex flex-wrap gap-2">
          <li>
            <Badge variante={disponible ? 'positif' : 'negatif'}>
              {disponible ? 'Disponible' : 'Épuisé'}
            </Badge>
          </li>
          <li>
            <Badge variante={produit.est_livrable ? 'positif' : 'neutre'}>
              {produit.est_livrable ? 'Livrable' : 'Retrait sur place'}
            </Badge>
          </li>
          {produit.est_personnalisable && (
            <li>
              <Badge variante="attente">Personnalisable</Badge>
            </li>
          )}
        </ul>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray-500">
            Description
          </h2>
          <p className="mt-2 leading-relaxed text-warm-gray-600">
            {produit.description ?? 'Aucune description pour ce produit.'}
          </p>
        </div>

        <dl className="grid gap-2 rounded-xl border border-warm-gray-200 bg-white p-4 text-sm">
          <Ligne terme="Disponibilité">
            {disponible ? `En stock (${produit.stock_disponible})` : 'Épuisé'}
          </Ligne>
          <Ligne terme="Unité de vente">{produit.unite_mesure}</Ligne>
          <Ligne terme="Livraison">
            {produit.est_livrable ? 'Possible' : 'Non, retrait sur place uniquement'}
          </Ligne>
          <Ligne terme="Personnalisation">
            {produit.est_personnalisable
              ? produit.supplement_personnalisation !== null
                ? `Oui, +${formaterMontant(produit.supplement_personnalisation)} par unité`
                : 'Oui'
              : 'Non'}
          </Ligne>
        </dl>

        {/* Un produit épuisé ne peut pas être ajouté : le bloc d'achat
            disparaît plutôt que d'échouer silencieusement au clic. */}
        {disponible ? (
          <AjoutPanierProduit produit={produit} />
        ) : (
          <p className="rounded-lg bg-terracotta/10 px-4 py-3 text-terracotta">
            Ce produit est épuisé, il ne peut pas être commandé.
          </p>
        )}
      </div>
    </article>
  );
}

function Ligne({ terme, children }: { terme: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-warm-gray-500">{terme}</dt>
      <dd className="text-right font-medium text-warm-gray-700">{children}</dd>
    </div>
  );
}

function LienRetour() {
  return <BoutonRetour vers="/produits">Retour au catalogue</BoutonRetour>;
}
