/**
 * Tableau de suivi de consommation d'un abonnement.
 *
 * **Reflète `mode_suivi` concrètement, pas seulement les lignes brutes de
 * l'API** : en `Individuel`, chaque ligne résout `id_beneficiaire` en
 * nom/prénom via `beneficiaires` (chargé séparément par
 * `useAbonnementDetailAdministration`, filtré côté serveur par
 * `id_abonnement`). En `Global`, aucune colonne bénéficiaire — la
 * consommation reste agrégée, il n'y a rien à résoudre.
 *
 * Extrait de la page de détail pour qu'elle reste lisible (SRP, cf.
 * `docs/architecture.md`).
 */

import type { Beneficiaire, ConsommationRepas, ModeSuivi } from '../abonnement.types';

interface Proprietes {
  modeSuivi: ModeSuivi;
  consommations: ConsommationRepas[];
  /** `null` tant que non chargé, ou toujours en mode `Global`. */
  beneficiaires: Beneficiaire[] | null;
}

function nomBeneficiaire(
  idBeneficiaire: number | null,
  beneficiaires: Beneficiaire[] | null
): string {
  if (idBeneficiaire === null) {
    return '—';
  }
  const trouve = beneficiaires?.find((b) => b.id_beneficiaire === idBeneficiaire);
  return trouve !== undefined ? `${trouve.prenom} ${trouve.nom}` : `#${idBeneficiaire}`;
}

export default function TableauConsommation({
  modeSuivi,
  consommations,
  beneficiaires,
}: Proprietes) {
  if (consommations.length === 0) {
    return <p className="mt-4 text-warm-gray-600">Aucune consommation enregistrée.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
        <thead>
          <tr className="border-b border-warm-gray-200 text-left">
            <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">Date</th>
            {modeSuivi === 'Individuel' && (
              <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                Bénéficiaire
              </th>
            )}
            <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
              Quantité
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-gray-200">
          {consommations.map((consommation) => (
            <tr key={consommation.id_consommation}>
              <td className="px-3 py-2 text-sm text-warm-gray-700">
                {consommation.date_consommation}
              </td>
              {modeSuivi === 'Individuel' && (
                <td className="px-3 py-2 text-sm text-warm-gray-700">
                  {nomBeneficiaire(consommation.id_beneficiaire, beneficiaires)}
                </td>
              )}
              <td className="px-3 py-2 text-sm text-warm-gray-700">
                {consommation.quantite}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
