/**
 * Fiche d'un domaine de formation, administration.
 *
 * Son contenu utile est la liste de **ses formations**, actives et archivées —
 * c'est aussi ce qui explique un refus d'archivage (« le domaine contient
 * encore des formations »). Chaque formation mène à sa propre fiche.
 */

import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import ChampFiche from '@/components/ui/ChampFiche';
import { formaterMontant } from '@/features/commande/commande.service';
import {
  CLASSES_LIGNE_CLIQUABLE,
  useNavigationAuClic,
} from '@/lib/useNavigationAuClic';

import { modifierDomaine } from '../formation.api';
import {
  estArchive,
  messageDAdministration,
  useActionsDomaines,
  useDomainesAdministration,
  useFormationsAdministration,
} from '../formation.administration';

const CLASSES_ALERTE =
  'rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta';

interface Edition {
  libelle: string;
  description: string;
}

export default function DomaineDetailAdministrationPage() {
  const { idDomaine } = useParams<{ idDomaine: string }>();
  const id = Number(idDomaine);

  const domaines = useDomainesAdministration();
  const formations = useFormationsAdministration();
  const actions = useActionsDomaines(() => {
    domaines.recharger();
    formations.recharger();
  });
  const naviguerAuClic = useNavigationAuClic();
  const [edition, setEdition] = useState<Edition | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const domaine = domaines.domaines.find((d) => d.id_domaine === id) ?? null;

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    if (edition === null || edition.libelle.trim() === '') return;
    setEnvoi(true);
    setErreurEdition(null);
    try {
      await modifierDomaine(id, {
        libelle: edition.libelle.trim(),
        description:
          edition.description.trim() === '' ? null : edition.description.trim(),
      });
      domaines.recharger();
      setEdition(null);
    } catch (erreur) {
      setErreurEdition(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (domaines.chargement && domaine === null) {
    return (
      <p role="status" className="text-warm-gray-500">
        Chargement…
      </p>
    );
  }
  if (domaine === null) {
    return (
      <p role="alert" className={CLASSES_ALERTE}>
        {domaines.erreur ?? 'Domaine introuvable.'}
      </p>
    );
  }

  const archive = estArchive(domaine);
  const sesFormations = formations.formations
    .filter((f) => f.id_domaine === id)
    .sort((a, b) => a.titre.localeCompare(b.titre));
  const actives = sesFormations.filter((f) => !estArchive(f)).length;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-warm-gray-700">
            {domaine.libelle}
          </h1>
          <Badge variante={archive ? 'negatif' : 'positif'}>
            {archive ? 'Archivé' : 'Actif'}
          </Badge>
        </div>
        <Link
          to="/personnel/domaines-formation"
          className="text-sm text-terracotta underline"
        >
          Retour à la liste
        </Link>
      </div>

      {actions.erreur !== null && (
        <p role="alert" className={`mt-4 ${CLASSES_ALERTE}`}>
          {actions.erreur}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
        {edition !== null ? (
          <form onSubmit={(e) => void enregistrer(e)} className="grid gap-3">
            <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
              Libellé
              <input
                value={edition.libelle}
                onChange={(e) => setEdition({ ...edition, libelle: e.target.value })}
                required
                className="rounded border border-warm-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
              Description (facultative)
              <textarea
                value={edition.description}
                onChange={(e) =>
                  setEdition({ ...edition, description: e.target.value })
                }
                rows={3}
                className="rounded border border-warm-gray-300 px-2 py-1.5"
              />
            </label>
            <div className="flex gap-2">
              <Bouton type="submit" disabled={envoi}>
                Enregistrer
              </Bouton>
              <Bouton
                variante="secondaire"
                onClick={() => {
                  setEdition(null);
                  setErreurEdition(null);
                }}
              >
                Annuler
              </Bouton>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <ChampFiche intitule="Formations">
                {sesFormations.length} formation(s), dont {actives} active(s)
              </ChampFiche>
              <div className="sm:col-span-2">
                <ChampFiche intitule="Description">
                  {domaine.description ?? (
                    <span className="text-warm-gray-500">Aucune</span>
                  )}
                </ChampFiche>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {archive ? (
                <Bouton
                  variante="secondaire"
                  disabled={actions.envoi}
                  onClick={() => void actions.restaurerLeDomaine(id)}
                >
                  Restaurer
                </Bouton>
              ) : (
                <>
                  <Bouton
                    variante="secondaire"
                    onClick={() =>
                      setEdition({
                        libelle: domaine.libelle,
                        description: domaine.description ?? '',
                      })
                    }
                  >
                    Modifier
                  </Bouton>
                  <Bouton
                    variante="secondaire"
                    disabled={actions.envoi}
                    onClick={() => void actions.archiverLeDomaine(id)}
                  >
                    Archiver
                  </Bouton>
                </>
              )}
            </div>
          </>
        )}
        {erreurEdition !== null && (
          <p role="alert" className={`mt-3 ${CLASSES_ALERTE}`}>
            {erreurEdition}
          </p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-medium text-warm-gray-700">
        Formations du domaine
      </h2>
      {sesFormations.length === 0 ? (
        <p className="mt-2 text-sm text-warm-gray-500">
          Aucune formation dans ce domaine.
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse rounded-xl bg-white shadow-sm">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                Titre
              </th>
              <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                Niveau
              </th>
              <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">Prix</th>
              <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">État</th>
            </tr>
          </thead>
          <tbody>
            {sesFormations.map((formation) => {
              const fiche = `/personnel/formations/${formation.id_formation}`;
              const formationArchivee = estArchive(formation);
              return (
                <tr
                  key={formation.id_formation}
                  onClick={naviguerAuClic(fiche)}
                  className={`border-t border-warm-gray-100 ${CLASSES_LIGNE_CLIQUABLE}`}
                >
                  <td className="px-3 py-2 text-sm">
                    <Link to={fiche} className="text-warm-gray-700 hover:underline">
                      {formation.titre}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {formation.niveau ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {formaterMontant(formation.prix)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variante={formationArchivee ? 'negatif' : 'positif'}>
                      {formationArchivee ? 'Archivée' : 'Active'}
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
