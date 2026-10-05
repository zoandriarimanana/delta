/**
 * Administration de l'assistant IA (Sprint 12).
 *
 * Trois choses, dans l'ordre où un administrateur en a besoin : **constater**
 * l'état (activé ? Groq joignable ? index rempli ?), **reconstruire** l'index
 * si besoin, et **interroger** l'assistant comme un client le ferait — avec la
 * même fenêtre que la bulle du site, pour voir exactement ce que voit un
 * visiteur.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur. Un salarié sans droit voit l'écran et reçoit un 403, rendu lisible.
 */

import { useState } from 'react';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import { useEtatAssistant, useReindexation } from '../assistant.administration';
import { useConversation } from '../assistant.hooks';
import { libelleType } from '../assistant.service';
import FenetreConversation from '../components/FenetreConversation';

const CLASSES_ALERTE =
  'mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta';

export default function AdministrationAssistantPage() {
  const etat = useEtatAssistant();
  const reindexation = useReindexation(etat.recharger);
  const conversation = useConversation();
  const [confirmation, setConfirmation] = useState(false);

  const donnees = etat.etat;
  const types = Object.entries(donnees?.fragments_par_type ?? {}).sort(([a], [b]) =>
    libelleType(a).localeCompare(libelleType(b))
  );

  return (
    <section>
      <h1 className="text-2xl font-semibold text-warm-gray-700">Assistant IA</h1>
      <p className="mt-1 text-sm text-warm-gray-500">
        Répond aux visiteurs à partir du catalogue public — jamais à partir des prix,
        des stocks ni des données des clients ou du personnel.
      </p>

      {etat.erreur !== null && (
        <p role="alert" className={CLASSES_ALERTE}>
          {etat.erreur}
        </p>
      )}

      {etat.chargement && donnees === null && (
        <p role="status" className="mt-6 text-warm-gray-500">
          Chargement…
        </p>
      )}

      {donnees !== null && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-warm-gray-200 bg-white p-4">
            <h2 className="text-lg font-medium text-warm-gray-700">État</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-warm-gray-500">Assistant</dt>
                <dd>
                  <Badge variante={donnees.actif ? 'positif' : 'neutre'}>
                    {donnees.actif ? 'Activé' : 'Désactivé'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-warm-gray-500">Modèle de langage (Groq)</dt>
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
                <dt className="text-warm-gray-500">Modèle de réponse</dt>
                <dd className="truncate font-mono text-xs text-warm-gray-700">
                  {donnees.modele_llm}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-warm-gray-500">Modèle d’indexation</dt>
                <dd className="truncate font-mono text-xs text-warm-gray-700">
                  {donnees.modele_embeddings}
                </dd>
              </div>
            </dl>
            {!donnees.actif && (
              <p className="mt-3 text-xs text-warm-gray-500">
                L’assistant s’active côté serveur (<code>AI_ENABLED=true</code> et les
                clés d’API) : la bulle n’apparaît sur le site qu’une fois activé.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-warm-gray-200 bg-white p-4">
            <h2 className="text-lg font-medium text-warm-gray-700">Index</h2>
            <p className="mt-1 text-sm text-warm-gray-500">
              {donnees.total_fragments} fragment(s) indexé(s). L’index se met à jour
              seul à chaque modification du catalogue.
            </p>
            {types.length > 0 ? (
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {types.map(([type, nombre]) => (
                    <tr key={type} className="border-t border-warm-gray-100">
                      <td className="py-1.5 text-warm-gray-700">{libelleType(type)}</td>
                      <td className="py-1.5 text-right tabular-nums text-warm-gray-700">
                        {nombre}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              donnees.actif && (
                <p className="mt-3 text-sm text-amber">
                  L’index est vide : lancez une réindexation complète.
                </p>
              )
            )}

            <div className="mt-4">
              {confirmation ? (
                <div className="space-y-2">
                  <p className="text-sm text-warm-gray-600">
                    Reconstruire tout l’index ? Cela peut prendre une minute ; les
                    réponses restent possibles pendant ce temps.
                  </p>
                  <div className="flex gap-2">
                    <Bouton
                      disabled={reindexation.enCours}
                      onClick={() => {
                        setConfirmation(false);
                        void reindexation.lancer();
                      }}
                    >
                      Confirmer
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      onClick={() => setConfirmation(false)}
                    >
                      Annuler
                    </Bouton>
                  </div>
                </div>
              ) : (
                <Bouton
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
              <p role="status" className="mt-3 text-sm text-sage">
                Réindexation terminée : {reindexation.resultat.total_fragments}{' '}
                fragment(s).
              </p>
            )}
          </div>
        </div>
      )}

      {donnees?.actif === true && (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white">
          <div className="border-b border-warm-gray-200 p-4">
            <h2 className="text-lg font-medium text-warm-gray-700">
              Interroger l’assistant
            </h2>
            <p className="mt-1 text-sm text-warm-gray-500">
              Exactement ce que voit un visiteur dans la bulle du site.
            </p>
          </div>
          <FenetreConversation conversation={conversation} className="h-[32rem]" />
        </div>
      )}
    </section>
  );
}
