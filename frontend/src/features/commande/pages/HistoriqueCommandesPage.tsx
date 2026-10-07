/**
 * Historique des commandes du client connecté : en cours, terminées, annulées.
 *
 * L'isolation entre clients est garantie côté serveur : le filtre vient du
 * jeton, et la commande d'un autre répond 404 — jamais 403, qui confirmerait
 * son existence. Rien ici ne peut l'affaiblir, aucun identifiant de client
 * n'est envoyé.
 *
 * Dans chaque onglet, l'**ordre du serveur** est conservé (de la plus récente
 * à la plus ancienne) : la page range, elle ne retrie pas.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, ShoppingBag } from 'lucide-react';

import { useEstConnecte } from '@/lib/useEstConnecte';

import CarteCommandeClient from '../components/CarteCommandeClient';
import { etapeCommande, type EtapeCommande } from '../commande.service';
import { useHistorique } from '../commande.hooks';
import type { Commande } from '../commande.types';

const ONGLETS: { etape: EtapeCommande; libelle: string; vide: string }[] = [
  { etape: 'en_cours', libelle: 'En cours', vide: 'Aucune commande en cours.' },
  { etape: 'terminee', libelle: 'Terminées', vide: 'Aucune commande terminée.' },
  { etape: 'annulee', libelle: 'Annulées', vide: 'Aucune commande annulée.' },
];

export default function HistoriqueCommandesPage() {
  const connecte = useEstConnecte();
  const { commandes, chargement, erreur, recharger } = useHistorique(connecte);
  const [onglet, setOnglet] = useState<EtapeCommande>('en_cours');

  const parEtape = useMemo(() => {
    const groupes: Record<EtapeCommande, Commande[]> = {
      en_cours: [],
      terminee: [],
      annulee: [],
    };
    for (const commande of commandes) {
      groupes[etapeCommande(commande)].push(commande);
    }
    return groupes;
  }, [commandes]);

  if (!connecte) {
    return (
      <section className="mx-auto max-w-lg py-12 text-center">
        <ClipboardList size={40} aria-hidden className="mx-auto text-primaire" />
        <h1 className="mt-4 text-3xl font-semibold text-gris-700">Mes commandes</h1>
        <p className="mt-2 text-gris-500">
          Connectez-vous pour retrouver vos commandes.
        </p>
        <Link
          to="/connexion"
          className="mt-6 inline-block rounded-full bg-action px-6 py-3 font-semibold text-white no-underline hover:bg-action-fonce"
        >
          Se connecter
        </Link>
        {/* Une commande passée sans compte ne figure dans aucun historique :
            elle se consulte par sa référence, communiquée à la validation. */}
        <p className="mt-6 text-sm text-gris-500">
          Vous avez commandé sans compte ? Utilisez le lien qui vous a été donné au
          moment de la validation.
        </p>
      </section>
    );
  }

  const courant = ONGLETS.find((o) => o.etape === onglet)!;
  const liste = parEtape[onglet];

  return (
    <section>
      <h1 className="text-3xl font-semibold text-gris-700">Mes commandes</h1>
      <p className="mt-1 text-gris-500">
        Suivez vos commandes, réglez celles en attente et retrouvez vos achats.
      </p>

      {chargement && (
        <p role="status" className="mt-4 text-gris-500">
          Chargement…
        </p>
      )}

      {erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger"
        >
          {erreur}
        </p>
      )}

      {!chargement && erreur === null && commandes.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-gris-300 bg-surface p-10 text-center">
          <ShoppingBag size={36} aria-hidden className="mx-auto text-primaire" />
          <p className="mt-3 text-gris-500">
            Vous n’avez pas encore passé de commande.
          </p>
          <Link
            to="/produits"
            className="mt-6 inline-block rounded-full bg-action px-6 py-3 font-semibold text-white no-underline hover:bg-action-fonce"
          >
            Parcourir le catalogue
          </Link>
        </div>
      )}

      {commandes.length > 0 && (
        <>
          <div
            role="tablist"
            aria-label="Rubriques de commandes"
            className="mt-6 flex gap-1 overflow-x-auto border-b border-gris-200"
          >
            {ONGLETS.map(({ etape, libelle }) => {
              const actif = etape === onglet;
              return (
                <button
                  key={etape}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setOnglet(etape)}
                  className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    actif
                      ? 'border-primaire text-primaire'
                      : 'border-transparent text-gris-500 hover:text-gris-700'
                  }`}
                >
                  {libelle}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      actif
                        ? 'bg-primaire text-sur-couleur'
                        : 'bg-gris-200 text-gris-600'
                    }`}
                  >
                    {parEtape[etape].length}
                  </span>
                </button>
              );
            })}
          </div>

          {liste.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-gris-300 bg-surface p-10 text-center text-gris-500">
              {courant.vide}
            </p>
          ) : (
            <ul role="tabpanel" aria-label={courant.libelle} className="mt-6 space-y-4">
              {liste.map((commande) => (
                <CarteCommandeClient
                  key={commande.id_commande}
                  commande={commande}
                  surPaiementConfirme={recharger}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
