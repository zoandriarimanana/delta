/**
 * Fiche d'une commande, administration (Sprint 10.6).
 *
 * Trois actions, chacune ses propres conditions d'apparition :
 *
 * - **Annuler** — tant que la commande n'est ni déjà `Annulee` ni à son
 *   statut terminal (`Livree`/`Servie`), même garde que le serveur (10.5).
 * - **Relancer la livraison** — seulement si une livraison `Echouee` existe
 *   pour cette commande (10.4). Absente sinon : la plupart des commandes
 *   n'ont pas de livraison du tout, ou une livraison qui n'a jamais échoué.
 * - **Marquer remboursée** — toujours proposée, y compris sur une commande
 *   jamais payée : c'est une décision administrative délibérée, pas une
 *   garde oubliée (cf. `docs/mld.md`, `CommandeService.rembourser`).
 *
 * **Aucun état local à préserver entre actions**, contrairement à
 * `PersonnelDetailAdministrationPage` : ni `annuler` ni `rembourser` n'archive
 * la commande, la fiche peut donc simplement se recharger depuis le serveur
 * après chacune.
 */

import { Link, useParams } from 'react-router';

import Bouton from '@/components/ui/Bouton';

import RecapitulatifCommande from '../components/RecapitulatifCommande';
import { formaterDate } from '../commande.service';
import {
  useActionsCommandeAdministration,
  useActionRelanceLivraison,
  useCommandeDetailAdministration,
  useLivraisonEchoueeDeLaCommande,
} from '../commande.administration';

export default function CommandeDetailAdministrationPage() {
  const { idCommande } = useParams<{ idCommande: string }>();
  const id = Number(idCommande);

  const detail = useCommandeDetailAdministration(id);
  const actions = useActionsCommandeAdministration(id, detail.recharger);
  const livraisonEchouee = useLivraisonEchoueeDeLaCommande(id);
  const relance = useActionRelanceLivraison(() => {
    livraisonEchouee.recharger();
    detail.recharger();
  });

  if (detail.chargement) {
    return (
      <p role="status" className="text-warm-gray-500">
        Chargement…
      </p>
    );
  }

  if (detail.commande === null) {
    return (
      <p
        role="alert"
        className="rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
      >
        {detail.erreur ?? 'Commande introuvable.'}
      </p>
    );
  }

  const commande = detail.commande;
  const peutAnnuler =
    commande.statut !== 'Annulee' &&
    commande.statut !== 'Livree' &&
    commande.statut !== 'Servie';

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-warm-gray-700">
          Commande n° {commande.id_commande}
        </h1>
        <Link
          to="/personnel/commandes/administration"
          className="text-sm text-terracotta underline"
        >
          Retour à la liste
        </Link>
      </div>

      <time
        dateTime={commande.date_commande}
        className="mt-1 block text-sm text-warm-gray-500"
      >
        {formaterDate(commande.date_commande)}
      </time>

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {actions.erreur}
        </p>
      )}

      {relance.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {relance.erreur}
        </p>
      )}

      {commande.rembourse_le !== null && (
        <p className="mt-4 rounded border border-warm-gray-200 bg-white p-3 text-sm text-warm-gray-700">
          Remboursée le {formaterDate(commande.rembourse_le)}.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
        <RecapitulatifCommande commande={commande} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {peutAnnuler && (
          <Bouton
            variante="secondaire"
            onClick={() => void actions.annuler()}
            disabled={actions.envoi}
          >
            Annuler
          </Bouton>
        )}
        {livraisonEchouee.livraison !== null && (
          <Bouton
            variante="secondaire"
            onClick={() => {
              const idLivraison = livraisonEchouee.livraison?.id_livraison;
              if (idLivraison !== undefined) {
                void relance.relancer(idLivraison);
              }
            }}
            disabled={relance.envoi}
          >
            Relancer la livraison
          </Bouton>
        )}
        <Bouton
          variante="secondaire"
          onClick={() => void actions.rembourser()}
          disabled={actions.envoi}
        >
          Marquer remboursée
        </Bouton>
      </div>
    </section>
  );
}
