/**
 * Fiche abonnement, administration.
 *
 * **Orchestration à 3-4 appels**, portée par
 * `useAbonnementDetailAdministration` : l'abonnement, son solde (calculé à la
 * demande, jamais stocké — aucune entité FACTURE), ses consommations
 * filtrées par `id_abonnement`, et ses bénéficiaires filtrés de même
 * **uniquement si `mode_suivi = Individuel`**. Un seul GET ne suffit pas :
 * `AbonnementRead` ne porte ni le solde ni les consommations.
 */

import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Archive, Pencil, Plus } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';

import FormulaireAbonnement from '../components/FormulaireAbonnement';
import TableauConsommation from '../components/TableauConsommation';
import {
  messageDAdministration,
  useAbonnementDetailAdministration,
  useActionsAbonnement,
  useAjouterBeneficiaire,
} from '../abonnement.administration';
import type { AbonnementEnvoye, BeneficiaireEnvoye } from '../abonnement.types';

export default function AbonnementDetailAdministrationPage() {
  const { idAbonnement } = useParams<{ idAbonnement: string }>();
  const id = Number(idAbonnement);
  const navigate = useNavigate();

  const detail = useAbonnementDetailAdministration(id);
  const actions = useActionsAbonnement(detail.recharger);
  const beneficiaireAction = useAjouterBeneficiaire(detail.recharger);

  const [modeEdition, setModeEdition] = useState(false);
  const [envoiFormulaire, setEnvoiFormulaire] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);
  const [ajoutBeneficiaireOuvert, setAjoutBeneficiaireOuvert] = useState(false);
  const [nomBadge, setNomBadge] = useState({ nom: '', prenom: '', badge: '' });

  const fermerEdition = useCallback(() => {
    setModeEdition(false);
    setErreurFormulaire(null);
  }, []);

  async function enregistrer(valeurs: AbonnementEnvoye) {
    setEnvoiFormulaire(true);
    setErreurFormulaire(null);
    try {
      await actions.modifierUnAbonnement(id, valeurs);
      detail.recharger();
      fermerEdition();
    } catch (erreur) {
      setErreurFormulaire(messageDAdministration(erreur));
    } finally {
      setEnvoiFormulaire(false);
    }
  }

  async function archiver() {
    const ok = await actions.archiverUnAbonnement(id);
    if (ok) {
      navigate('/personnel/abonnements');
    }
  }

  async function ajouterBeneficiaire() {
    const donnees: BeneficiaireEnvoye = {
      id_abonnement: id,
      nom: nomBadge.nom,
      prenom: nomBadge.prenom,
      identifiant_badge: nomBadge.badge,
    };
    const ok = await beneficiaireAction.ajouter(donnees);
    if (ok) {
      setNomBadge({ nom: '', prenom: '', badge: '' });
      setAjoutBeneficiaireOuvert(false);
    }
  }

  if (detail.chargement) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }

  if (detail.erreur !== null || detail.abonnement === null) {
    return (
      <p
        role="alert"
        className="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      >
        {detail.erreur ?? 'Abonnement introuvable.'}
      </p>
    );
  }

  const { abonnement, solde } = detail;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gris-700">
        Abonnement #{abonnement.id_abonnement}
      </h1>

      {actions.erreur !== null && (
        // Repris tel quel : « Cet abonnement couvre encore au moins un
        // bénéficiaire actif » dit quoi corriger.
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {actions.erreur}
        </p>
      )}

      {modeEdition ? (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <h2 className="mb-4 text-lg font-medium text-gris-700">
            Modifier l'abonnement
          </h2>
          <FormulaireAbonnement
            entreprises={[]}
            abonnement={abonnement}
            envoi={envoiFormulaire}
            erreur={erreurFormulaire}
            surEnvoi={(valeurs) => void enregistrer(valeurs)}
            surAnnulation={fermerEdition}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gris-500">Période</dt>
              <dd className="text-gris-700">
                {abonnement.date_debut} → {abonnement.date_fin}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Type de facturation</dt>
              <dd className="text-gris-700">
                {abonnement.type_facturation === 'Forfait'
                  ? 'Forfait'
                  : 'Consommation réelle'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Mode de suivi</dt>
              <dd className="text-gris-700">{abonnement.mode_suivi}</dd>
            </div>
            {solde !== null && (
              <div>
                <dt className="text-sm text-gris-500">Montant facturé</dt>
                <dd className="text-gris-700">{solde.montant_facture}</dd>
              </div>
            )}
            {solde?.repas_restants !== null && solde?.repas_restants !== undefined && (
              <div>
                <dt className="text-sm text-gris-500">Repas restants</dt>
                <dd
                  className={
                    solde.repas_restants < 0 ? 'text-primaire' : 'text-gris-700'
                  }
                >
                  {solde.repas_restants}
                  {solde.repas_restants < 0 && ' (forfait dépassé)'}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex gap-2">
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
              onClick={() => void archiver()}
            >
              Archiver
            </Bouton>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gris-700">Suivi de consommation</h2>
          {abonnement.mode_suivi === 'Individuel' && (
            <Bouton
              variante="primaire"
              icone={Plus}
              onClick={() => setAjoutBeneficiaireOuvert((o) => !o)}
            >
              Ajouter un bénéficiaire
            </Bouton>
          )}
        </div>

        {ajoutBeneficiaireOuvert && (
          <form
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gris-200 bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void ajouterBeneficiaire();
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-gris-700">
              Nom
              <input
                required
                value={nomBadge.nom}
                onChange={(e) => setNomBadge((v) => ({ ...v, nom: e.target.value }))}
                className="rounded border border-gris-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gris-700">
              Prénom
              <input
                required
                value={nomBadge.prenom}
                onChange={(e) => setNomBadge((v) => ({ ...v, prenom: e.target.value }))}
                className="rounded border border-gris-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gris-700">
              Badge
              <input
                required
                value={nomBadge.badge}
                onChange={(e) => setNomBadge((v) => ({ ...v, badge: e.target.value }))}
                className="rounded border border-gris-300 px-2 py-1"
              />
            </label>
            <Bouton
              variante="valider"
              type="submit"
              disabled={beneficiaireAction.envoi}
            >
              Ajouter
            </Bouton>
            {beneficiaireAction.erreur !== null && (
              <p role="alert" className="w-full text-sm text-danger">
                {beneficiaireAction.erreur}
              </p>
            )}
          </form>
        )}

        <TableauConsommation
          modeSuivi={abonnement.mode_suivi}
          consommations={detail.consommations}
          beneficiaires={detail.beneficiaires}
        />
      </div>
    </section>
  );
}
