/**
 * Page publique d'une commande invitée, atteinte par sa référence.
 *
 * C'est la destination après validation d'une commande sans compte, et l'URL
 * que l'invité peut mettre en favori. Aucune authentification : il n'en a pas.
 */

import { Link, useParams } from 'react-router';

import ReferencePublique from '../components/ReferencePublique';
import RecapitulatifCommande from '../components/RecapitulatifCommande';
import { useCommandeInvitee } from '../commande.hooks';

export default function CommandeInviteePage() {
  const { reference } = useParams();
  const { commande, chargement, erreur } = useCommandeInvitee(reference ?? null);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Votre commande</h1>

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

      {commande !== null && (
        <div className="mt-6 space-y-6">
          {commande.reference_publique !== null && (
            <ReferencePublique reference={commande.reference_publique} />
          )}
          <RecapitulatifCommande commande={commande} />
        </div>
      )}

      <Link to="/produits" className="mt-6 inline-block text-slate-900 underline">
        Retour au catalogue
      </Link>
    </section>
  );
}
