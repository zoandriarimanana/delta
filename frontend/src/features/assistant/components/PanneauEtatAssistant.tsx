/**
 * État de l'assistant et de son index, et réindexation complète.
 *
 * Extrait de `AdministrationAssistantPage` pour que la page reste un simple
 * assemblage de panneaux (règle des ~500 lignes, `CONTRIBUTING.md`).
 */

import { useState } from 'react';

import Badge from '@/components/ui/Badge';
import { RefreshCw } from 'lucide-react';
import Bouton from '@/components/ui/Bouton';

import type { EtatAdministration, Reindexation } from '../assistant.administration';
import { libelleType } from '../assistant.service';

const CLASSES_ALERTE =
  'mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger';

interface Proprietes {
  etat: EtatAdministration;
  reindexation: Reindexation;
}

export default function PanneauEtatAssistant({ etat, reindexation }: Proprietes) {
  const [confirmation, setConfirmation] = useState(false);
  const donnees = etat.etat;
  if (donnees === null) {
    return null;
  }
  const types = Object.entries(donnees.fragments_par_type).sort(([a], [b]) =>
    libelleType(a).localeCompare(libelleType(b))
  );

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-gris-200 bg-surface p-4">
        <h2 className="text-lg font-medium text-gris-700">État</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gris-500">Assistant</dt>
            <dd>
              <Badge variante={donnees.actif ? 'positif' : 'neutre'}>
                {donnees.actif ? 'Activé' : 'Désactivé'}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gris-500">Modèle de langage (Groq)</dt>
            <dd>
              <Badge
                variante={
                  !donnees.actif
                    ? 'neutre'
                    : donnees.llm_joignable
                      ? 'positif'
                      : 'negatif'
                }
              >
                {!donnees.actif
                  ? 'Non vérifié'
                  : donnees.llm_joignable
                    ? 'Joignable'
                    : 'Injoignable'}
              </Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gris-500">Modèle de réponse</dt>
            <dd className="truncate font-mono text-xs text-gris-700">
              {donnees.modele_llm}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gris-500">Modèle d’indexation</dt>
            <dd className="truncate font-mono text-xs text-gris-700">
              {donnees.modele_embeddings}
            </dd>
          </div>
        </dl>
        {!donnees.actif && (
          <p className="mt-3 text-xs text-gris-500">
            L’assistant s’active côté serveur (<code>AI_ENABLED=true</code> et les clés
            d’API) : la bulle n’apparaît sur le site qu’une fois activé.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gris-200 bg-surface p-4">
        <h2 className="text-lg font-medium text-gris-700">Index</h2>
        <p className="mt-1 text-sm text-gris-500">
          {donnees.total_fragments} fragment(s) indexé(s). L’index se met à jour seul à
          chaque modification du catalogue ou de la base de connaissances.
        </p>
        {types.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {types.map(([type, nombre]) => (
                <tr key={type} className="border-t border-gris-100">
                  <td className="py-1.5 text-gris-700">{libelleType(type)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gris-700">
                    {nombre}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          donnees.actif && (
            <p className="mt-3 text-sm text-attente">
              L’index est vide : lancez une réindexation complète.
            </p>
          )
        )}

        <div className="mt-4">
          {confirmation ? (
            <div className="space-y-2">
              <p className="text-sm text-gris-600">
                Reconstruire tout l’index ? Cela peut prendre une minute ; les réponses
                restent possibles pendant ce temps.
              </p>
              <div className="flex gap-2">
                <Bouton
                  variante="attention"
                  icone={RefreshCw}
                  disabled={reindexation.enCours}
                  onClick={() => {
                    setConfirmation(false);
                    void reindexation.lancer();
                  }}
                >
                  Confirmer
                </Bouton>
                <Bouton variante="neutre" onClick={() => setConfirmation(false)}>
                  Annuler
                </Bouton>
              </div>
            </div>
          ) : (
            <Bouton
              variante="attention"
              icone={RefreshCw}
              disabled={!donnees.actif || reindexation.enCours}
              onClick={() => setConfirmation(true)}
            >
              {reindexation.enCours
                ? 'Réindexation en cours…'
                : 'Réindexer tout le catalogue'}
            </Bouton>
          )}
        </div>

        {reindexation.erreur !== null && (
          <p role="alert" className={CLASSES_ALERTE}>
            {reindexation.erreur}
          </p>
        )}
        {reindexation.resultat !== null && (
          <p role="status" className="mt-3 text-sm text-succes">
            Réindexation terminée : {reindexation.resultat.total_fragments} fragment(s).
          </p>
        )}
      </div>
    </div>
  );
}
