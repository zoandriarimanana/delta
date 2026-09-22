/**
 * Fiche d'une formation, administration.
 *
 * Modifier, archiver et restaurer vivent ici — la liste
 * (`AdministrationFormationsPage`) ne fait que créer et donner accès à la
 * fiche, même partage que `PERSONNEL`.
 *
 * **Le tableau des sessions n'est pas encore ici** : il arrive avec la
 * sous-tâche suivante du chantier (`SESSION_FORMATION`), embarqué dans cette
 * même fiche — même patron que `BENEFICIAIRE` dans
 * `AbonnementDetailAdministrationPage`.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import { formaterMontant } from '@/features/commande/commande.service';
import { imagePour } from '@/lib/images';

import FormulaireFormation from '../components/FormulaireFormation';
import { modifierFormation } from '../formation.api';
import {
  estArchive,
  messageDAdministration,
  useActionsFormations,
  useDomainesAdministration,
  useFormationDetailAdministration,
} from '../formation.administration';
import { formaterDuree } from '../formation.service';
import type { FormationEnvoyee } from '../formation.types';

export default function FormationDetailAdministrationPage() {
  const { idFormation } = useParams<{ idFormation: string }>();
  const id = Number(idFormation);

  const detail = useFormationDetailAdministration(id);
  const domaines = useDomainesAdministration();
  const actions = useActionsFormations(detail.recharger);
  const [modeEdition, setModeEdition] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  async function enregistrer(donnees: FormationEnvoyee) {
    setEnvoi(true);
    setErreurEdition(null);
    try {
      await modifierFormation(id, donnees);
      detail.recharger();
      setModeEdition(false);
    } catch (erreur) {
      setErreurEdition(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (detail.chargement) {
    return (
      <p role="status" className="text-warm-gray-500">
        Chargement…
      </p>
    );
  }

  if (detail.formation === null) {
    return (
      <p
        role="alert"
        className="rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
      >
        {detail.erreur ?? 'Formation introuvable.'}
      </p>
    );
  }

  const formation = detail.formation;
  const archive = estArchive(formation);
  const domaine = domaines.domaines.find((d) => d.id_domaine === formation.id_domaine);

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={imagePour('formation', formation.id_formation)}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
          <h1 className="text-2xl font-semibold text-warm-gray-700">
            {formation.titre}
          </h1>
          <Badge variante={archive ? 'negatif' : 'positif'}>
            {archive ? 'Archivée' : 'Active'}
          </Badge>
        </div>
        <Link to="/personnel/formations" className="text-sm text-terracotta underline">
          Retour à la liste
        </Link>
      </div>

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {actions.erreur}
        </p>
      )}

      {modeEdition ? (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            Modifier la formation
          </h2>
          <FormulaireFormation
            domaines={domaines.domaines}
            formation={formation}
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
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-warm-gray-500">Domaine</dt>
              <dd className="text-warm-gray-700">{domaine?.libelle ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Niveau</dt>
              <dd className="text-warm-gray-700">{formation.niveau ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Durée</dt>
              <dd className="text-warm-gray-700">
                {formaterDuree(formation.duree_heures)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Prix</dt>
              <dd className="text-warm-gray-700">{formaterMontant(formation.prix)}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Capacité maximale</dt>
              <dd className="text-warm-gray-700">{formation.capacite_max}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Hébergement</dt>
              <dd className="text-warm-gray-700">
                {formation.propose_hebergement ? 'Proposé' : 'Non proposé'}
              </dd>
            </div>
          </dl>

          {!archive && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Bouton variante="secondaire" onClick={() => setModeEdition(true)}>
                Modifier
              </Bouton>
              <Bouton
                variante="secondaire"
                onClick={() => void actions.archiverLaFormation(id)}
                disabled={actions.envoi}
              >
                Archiver
              </Bouton>
            </div>
          )}
          {archive && (
            <div className="mt-4">
              <Bouton
                variante="secondaire"
                onClick={() => void actions.restaurerLaFormation(id)}
                disabled={actions.envoi}
              >
                Restaurer
              </Bouton>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
