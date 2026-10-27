/**
 * Attente de la validation sur le téléphone.
 *
 * Le moment où un client hésite le plus : il a cliqué, rien ne se passe à
 * l'écran, tout se joue sur son téléphone. L'écran le lui dit, explique les
 * trois gestes attendus, montre qu'il attend activement, et donne une sortie
 * (« changer de numéro ») si la demande n'est jamais arrivée.
 */

import { Loader2, Smartphone } from 'lucide-react';

import { useTextes } from '@/lib/langue';

import { TEXTES_PAIEMENT } from '../paiement.textes';

interface Proprietes {
  montant: string;
  /** `null` pour un paiement par carte. */
  numero: string | null;
  nomOperateur: string;
  expire: boolean;
  simulation: boolean;
  envoi: boolean;
  surSimulation: () => void;
  surRecommencer: () => void;
}

export default function AttenteValidation({
  montant,
  numero,
  nomOperateur,
  expire,
  simulation,
  envoi,
  surSimulation,
  surRecommencer,
}: Proprietes) {
  const t = useTextes(TEXTES_PAIEMENT);

  return (
    <div className="space-y-5 text-center">
      <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primaire/20" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primaire/10 text-primaire">
          <Smartphone size={36} aria-hidden />
        </span>
      </span>

      {numero === null ? (
        <h3 className="text-lg font-semibold text-gris-700">{t.attenteCarte}</h3>
      ) : (
        <>
          <h3 className="text-xl font-semibold text-gris-700">{t.titreAttente}</h3>
          <p className="mx-auto max-w-md text-sm text-gris-600">
            {t.demandeEnvoyee(montant, numero, nomOperateur)}
          </p>
          <ol className="mx-auto max-w-sm space-y-2 text-left text-sm text-gris-600">
            {t.etapes.map((etape, rang) => (
              <li key={etape} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primaire text-xs font-semibold text-sur-couleur">
                  {rang + 1}
                </span>
                {etape}
              </li>
            ))}
          </ol>
        </>
      )}

      {expire ? (
        <p className="rounded-lg bg-attente/10 p-3 text-sm text-gris-700">
          {t.delaiDepasse}
        </p>
      ) : (
        <p
          role="status"
          className="flex items-center justify-center gap-2 text-sm font-medium text-primaire"
        >
          <Loader2 size={16} aria-hidden className="animate-spin" />
          {t.enAttenteDe(nomOperateur)}
        </p>
      )}

      {simulation && (
        <button
          type="button"
          onClick={surSimulation}
          disabled={envoi}
          className="rounded-full border border-dashed border-gris-400 px-4 py-2 text-xs text-gris-600 hover:bg-gris-100 disabled:opacity-50"
        >
          {t.simuler}
        </button>
      )}

      <button
        type="button"
        onClick={surRecommencer}
        className="block w-full text-sm font-medium text-primaire hover:underline"
      >
        {expire ? t.recommencer : t.rienRecu}
      </button>
    </div>
  );
}
