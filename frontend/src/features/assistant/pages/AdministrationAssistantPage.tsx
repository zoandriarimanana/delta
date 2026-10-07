/**
 * Administration de l'assistant IA (Sprint 12).
 *
 * Trois panneaux, dans l'ordre où un administrateur en a besoin : **constater**
 * l'état et reconstruire l'index, **enrichir** la base de connaissances, et
 * **interroger** l'assistant — celui du personnel, ou l'aperçu exact de la
 * bulle publique.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur. Un salarié sans droit voit l'écran et reçoit un 403, rendu lisible.
 */

import {
  useBaseDeConnaissances,
  useEtatAssistant,
  useReindexation,
} from '../assistant.administration';
import PanneauConversation from '../components/PanneauConversation';
import PanneauDocuments from '../components/PanneauDocuments';
import PanneauEtatAssistant from '../components/PanneauEtatAssistant';

export default function AdministrationAssistantPage() {
  const etat = useEtatAssistant();
  const base = useBaseDeConnaissances();
  const reindexation = useReindexation(etat.recharger);
  const actif = etat.etat?.actif === true;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gris-700">Assistant IA</h1>
      <p className="mt-1 text-sm text-gris-500">
        Répond aux visiteurs à partir du catalogue, du guide de la plateforme et des
        documents destinés aux clients — jamais à partir des stocks ni des données des
        clients ou du personnel. Le personnel dispose de son propre assistant.
      </p>

      {etat.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {etat.erreur}
        </p>
      )}

      {etat.chargement && etat.etat === null && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      <PanneauEtatAssistant etat={etat} reindexation={reindexation} />
      {actif && <PanneauDocuments base={base} />}
      {actif && <PanneauConversation />}
    </section>
  );
}
