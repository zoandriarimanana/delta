/**
 * Fiche d'un produit, administration.
 *
 * Même patron que `FormationDetailAdministrationPage` : tous les champs, la
 * note des clients, « Modifier », « Archiver », « Restaurer ». Le produit est
 * lu dans le catalogue d'administration (archives comprises) — une fiche doit
 * rester consultable après archivage, pour pouvoir la restaurer.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import { Archive, Pencil, RotateCcw } from 'lucide-react';
import Bouton from '@/components/ui/Bouton';
import NoteMoyenne from '@/components/ui/NoteMoyenne';
import { formaterMontant } from '@/features/commande/commande.service';
import { imageProduit } from '@/lib/images';

import ChampFiche from '@/components/ui/ChampFiche';
import GestionGalerie from '@/features/galerie/components/GestionGalerie';

import FormulaireProduit from '../components/FormulaireProduit';
import {
  estArchive,
  messageDAdministration,
  useActionsCatalogue,
  useCatalogueAdministration,
  useNoteProduit,
} from '../produit.administration';
import { modifierProduit } from '../produit.api';
import { formaterPrix } from '../produit.service';
import type { ProduitEnvoye } from '../produit.types';

const CLASSES_ALERTE =
  'rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger';

export default function ProduitDetailAdministrationPage() {
  const { idProduit } = useParams<{ idProduit: string }>();
  const id = Number(idProduit);

  const catalogue = useCatalogueAdministration();
  const actions = useActionsCatalogue(catalogue.recharger);
  const [modeEdition, setModeEdition] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const produit = catalogue.produits.find((p) => p.id_produit === id) ?? null;
  const archive = produit !== null && estArchive(produit);
  const note = useNoteProduit(id, produit !== null && !archive);

  async function enregistrer(donnees: ProduitEnvoye) {
    setEnvoi(true);
    setErreurEdition(null);
    try {
      await modifierProduit(id, donnees);
      catalogue.recharger();
      setModeEdition(false);
    } catch (erreur) {
      setErreurEdition(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (catalogue.chargement && produit === null) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }

  if (produit === null) {
    return (
      <p role="alert" className={CLASSES_ALERTE}>
        {catalogue.erreur ?? 'Produit introuvable.'}
      </p>
    );
  }

  const categorie = catalogue.categories.find(
    (c) => c.id_categorie === produit.id_categorie
  );

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <img
            src={imageProduit(produit.id_produit, produit.nom)}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
          <h1 className="text-2xl font-semibold text-gris-700">{produit.nom}</h1>
          <Badge variante={archive ? 'negatif' : 'positif'}>
            {archive ? 'Archivé' : 'Actif'}
          </Badge>
        </div>
        <Link to="/personnel/catalogue" className="text-sm text-primaire underline">
          Retour à la liste
        </Link>
      </div>

      {actions.erreur !== null && (
        <p role="alert" className={`mt-4 ${CLASSES_ALERTE}`}>
          {actions.erreur}
        </p>
      )}

      {modeEdition ? (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <h2 className="mb-4 text-lg font-medium text-gris-700">
            Modifier le produit
          </h2>
          <FormulaireProduit
            categories={catalogue.categories}
            produit={produit}
            envoi={envoi}
            erreur={erreurEdition}
            surEnvoi={(donnees) => void enregistrer(donnees)}
            surAnnulation={() => {
              setModeEdition(false);
              setErreurEdition(null);
            }}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ChampFiche intitule="Catégorie">
              {categorie !== undefined ? (
                <Link
                  to={`/personnel/categories/${categorie.id_categorie}`}
                  className="text-primaire underline"
                >
                  {categorie.libelle}
                </Link>
              ) : (
                '—'
              )}
            </ChampFiche>
            <ChampFiche intitule="Prix">{formaterPrix(produit)}</ChampFiche>
            <ChampFiche intitule="Stock disponible">
              {produit.stock_disponible}
            </ChampFiche>
            <ChampFiche intitule="Livraison">
              {produit.est_livrable ? 'Livrable' : 'Retrait sur place uniquement'}
            </ChampFiche>
            <ChampFiche intitule="Personnalisation">
              {produit.est_personnalisable
                ? `Personnalisable — supplément de ${produit.supplement_personnalisation !== null ? formaterMontant(produit.supplement_personnalisation) : '—'} par ${produit.unite_mesure}`
                : 'Non personnalisable'}
            </ChampFiche>
            <ChampFiche intitule="Avis des clients">
              {note.disponible ? (
                <NoteMoyenne moyenne={note.moyenne} nombre={note.nombre} />
              ) : (
                <span className="text-sm text-gris-500">
                  {archive ? 'Non calculé pour un produit archivé' : '—'}
                </span>
              )}
            </ChampFiche>
            <div className="sm:col-span-2">
              <ChampFiche intitule="Description">
                {produit.description ?? <span className="text-gris-500">Aucune</span>}
              </ChampFiche>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {archive ? (
              <Bouton
                variante="valider"
                icone={RotateCcw}
                disabled={actions.envoi}
                onClick={() => void actions.restaurerLeProduit(id)}
              >
                Restaurer
              </Bouton>
            ) : (
              <>
                <Bouton
                  variante="secondaire"
                  icone={Pencil}
                  onClick={() => setModeEdition(true)}
                >
                  Modifier
                </Bouton>
                <Bouton
                  variante="danger-contour"
                  icone={Archive}
                  disabled={actions.envoi}
                  onClick={() => void actions.archiverLeProduit(id)}
                >
                  Archiver
                </Bouton>
              </>
            )}
          </div>
        </div>
      )}

      {archive ? (
        <p className="mt-6 rounded-xl border border-gris-200 bg-surface p-4 text-sm text-gris-500">
          Les photos d’un produit archivé sont conservées, mais ne se gèrent qu’une fois
          restauré.
        </p>
      ) : (
        <GestionGalerie bien={{ produit: id }} />
      )}
    </section>
  );
}
