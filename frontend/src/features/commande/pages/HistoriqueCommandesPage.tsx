/**
 * Historique des commandes du client connecté.
 *
 * L'isolation entre clients est garantie côté serveur : le filtre vient du
 * jeton, et la commande d'un autre répond 404 — jamais 403, qui confirmerait
 * son existence. Rien ici ne peut l'affaiblir, aucun identifiant de client
 * n'est envoyé.
 */

import { Link } from 'react-router';

import { useEstConnecte } from '@/lib/useEstConnecte';

import RecapitulatifCommande from '../components/RecapitulatifCommande';
import { formaterDate } from '../commande.service';
import { useHistorique } from '../commande.hooks';

export default function HistoriqueCommandesPage() {
  const connecte = useEstConnecte();
  const { commandes, chargement, erreur } = useHistorique(connecte);

  if (!connecte) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Mes commandes</h1>
        <p className="mt-2 text-slate-600">
          Connectez-vous pour retrouver vos commandes.
        </p>
        <Link to="/connexion" className="mt-4 inline-block text-slate-900 underline">
          Se connecter
        </Link>
        {/* Une commande passée sans compte ne figure dans aucun historique :
            elle se consulte par sa référence, communiquée à la validation. */}
        <p className="mt-6 text-sm text-slate-500">
          Vous avez commandé sans compte ? Utilisez le lien qui vous a été donné au
          moment de la validation.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Mes commandes</h1>

      {chargement && (
        <p role="status" className="mt-4 text-slate-500">
          Chargement…
        </p>
      )}

      {erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {erreur}
        </p>
      )}

      {!chargement && erreur === null && commandes.length === 0 && (
        <>
          <p className="mt-4 text-slate-600">
            Vous n’avez pas encore passé de commande.
          </p>
          <Link to="/produits" className="mt-4 inline-block text-slate-900 underline">
            Parcourir le catalogue
          </Link>
        </>
      )}

      <ul className="mt-6 space-y-6">
        {commandes.map((commande) => (
          <li
            key={commande.id_commande}
            className="rounded border border-slate-200 bg-white p-4"
          >
            <h2 className="font-medium text-slate-900">
              Commande n° {commande.id_commande}
            </h2>
            {/* La date répond à « quand ai-je commandé ? », ce qu'un numéro ne
                dit pas. `<time>` porte la valeur brute pour les lecteurs
                d'écran et les outils, le texte reste lisible. */}
            <time
              dateTime={commande.date_commande}
              className="mt-1 block text-sm text-slate-500"
            >
              {formaterDate(commande.date_commande)}
            </time>
            <RecapitulatifCommande commande={commande} />
          </li>
        ))}
      </ul>
    </section>
  );
}
