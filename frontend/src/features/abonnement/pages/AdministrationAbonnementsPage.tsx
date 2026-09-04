/**
 * Administration des abonnements cantine.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, comme
 * `AdministrationProduitsPage`.
 *
 * **Pas de bouton « Restaurer »** : `GET /abonnements/administration` ne
 * remonte que les actifs, et aucun endpoint de restauration n'existe pour
 * ABONNEMENT — l'archivage est à sens unique, cohérent avec le périmètre
 * décidé en 7.1 (« CRUD courant, pas d'historique »).
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@/components/ui/Bouton';

import FormulaireAbonnement from '../components/FormulaireAbonnement';
import {
  messageDAdministration,
  useActionsAbonnement,
  useAbonnementsAdministration,
} from '../abonnement.administration';
import type { AbonnementEnvoye } from '../abonnement.types';

type Edition = { mode: 'ferme' } | { mode: 'creation' };

export default function AdministrationAbonnementsPage() {
  const donnees = useAbonnementsAdministration();
  const actions = useActionsAbonnement(donnees.recharger);
  const [edition, setEdition] = useState<Edition>({ mode: 'ferme' });
  const [envoiFormulaire, setEnvoiFormulaire] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setErreurFormulaire(null);
  }, []);

  function raisonSociale(idClientEntreprise: number): string {
    return (
      donnees.entreprises.find((e) => e.id_client === idClientEntreprise)
        ?.raison_sociale ?? '—'
    );
  }

  async function enregistrer(valeurs: AbonnementEnvoye) {
    setEnvoiFormulaire(true);
    setErreurFormulaire(null);
    try {
      await actions.creerUnAbonnement(valeurs);
      donnees.recharger();
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
          Administration des abonnements
        </h1>
        {edition.mode === 'ferme' && donnees.entreprises.length > 0 && (
          <Bouton onClick={() => setEdition({ mode: 'creation' })}>
            Nouvel abonnement
          </Bouton>
        )}
      </div>

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {donnees.erreur}
        </p>
      )}

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {actions.erreur}
        </p>
      )}

      {edition.mode === 'creation' && (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            Nouvel abonnement
          </h2>
          <FormulaireAbonnement
            entreprises={donnees.entreprises}
            envoi={envoiFormulaire}
            erreur={erreurFormulaire}
            surEnvoi={(valeurs) => void enregistrer(valeurs)}
            surAnnulation={fermer}
          />
        </div>
      )}

      {donnees.chargement && (
        <p role="status" className="mt-6 text-warm-gray-500">
          Chargement…
        </p>
      )}

      {!donnees.chargement && donnees.abonnements.length === 0 && (
        <p className="mt-6 text-warm-gray-600">Aucun abonnement à afficher.</p>
      )}

      {donnees.abonnements.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="border-b border-warm-gray-200 text-left">
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Entreprise
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Période
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Facturation
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Suivi
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-gray-200">
              {donnees.abonnements.map((abonnement) => (
                <tr key={abonnement.id_abonnement}>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {raisonSociale(abonnement.id_client_entreprise)}
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-600">
                    {abonnement.date_debut} → {abonnement.date_fin}
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {abonnement.type_facturation === 'Forfait'
                      ? 'Forfait'
                      : 'Consommation réelle'}
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {abonnement.mode_suivi}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/personnel/abonnements/${abonnement.id_abonnement}`}
                      className="text-sm text-terracotta underline"
                    >
                      Voir le détail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
