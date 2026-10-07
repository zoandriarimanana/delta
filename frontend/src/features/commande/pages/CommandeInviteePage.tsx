/**
 * Page publique d'une commande invitée, atteinte par sa référence.
 *
 * C'est la destination après validation d'une commande sans compte, et l'URL
 * que l'invité peut mettre en favori. Aucune authentification : il n'en a pas.
 *
 * L'adresse de livraison n'y figure pas, délibérément : un UUID suffit à
 * ouvrir cette page, et l'afficher la rendrait lisible par quiconque détient
 * le lien — même règle que `LivraisonPublique` (`docs/architecture.md`).
 */

import { Link, useParams } from 'react-router';
import {
  CheckCircle2,
  ShoppingBag,
  Store,
  Truck,
  UserPlus,
  UtensilsCrossed,
} from 'lucide-react';

import { EncartSuiviInvite } from '@/features/livraison/components/EncartSuivi';

import EtapesCommande from '../components/EtapesCommande';
import RecapitulatifCommande from '../components/RecapitulatifCommande';
import ReferencePublique from '../components/ReferencePublique';
import { useCommandeInvitee } from '../commande.hooks';
import { formaterDate } from '../commande.service';
import type { Commande } from '../commande.types';

export default function CommandeInviteePage() {
  const { reference } = useParams();
  const { commande, chargement, erreur } = useCommandeInvitee(reference ?? null);

  return (
    <section>
      {chargement && (
        <p role="status" className="text-gris-500">
          Chargement…
        </p>
      )}

      {erreur !== null && (
        <div className="mx-auto max-w-lg py-10 text-center">
          <h1 className="text-2xl font-semibold text-gris-700">Votre commande</h1>
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger"
          >
            {erreur}
          </p>
        </div>
      )}

      {commande !== null && (
        <>
          <EtapesCommande courante="Confirmation" />
          <EnTete commande={commande} />

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-6">
              {commande.reference_publique !== null && (
                <ReferencePublique reference={commande.reference_publique} />
              )}
              {/* Statut seul : cette URL n'a aucune authentification, un
                  UUID suffit à l'ouvrir. Ni l'identité ni le contact du
                  livreur n'y figurent — l'API ne les renvoie pas, et le type
                  ne les porte pas non plus. */}
              {reference !== undefined && <EncartSuiviInvite reference={reference} />}
              <div className="rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gris-700">Articles</h2>
                <RecapitulatifCommande commande={commande} />
              </div>
            </div>

            <Informations commande={commande} />
          </div>
        </>
      )}
    </section>
  );
}

function EnTete({ commande }: { commande: Commande }) {
  return (
    <div className="mt-6 flex items-start gap-4">
      <CheckCircle2 size={44} aria-hidden className="shrink-0 text-succes" />
      <div>
        <h1 className="text-3xl font-semibold text-gris-700">Votre commande</h1>
        <p className="mt-1 text-gris-600">
          Commande n° {commande.id_commande}
          {commande.nom_invite !== null && <>, au nom de {commande.nom_invite}</>} —
          passée le {formaterDate(commande.date_commande)}.
        </p>
      </div>
    </div>
  );
}

const MODES = {
  En_ligne: { icone: Truck, libelle: 'Livraison à domicile' },
  A_emporter: { icone: Store, libelle: 'Retrait en boutique' },
  Sur_place: { icone: UtensilsCrossed, libelle: 'Sur place' },
} as const;

function Informations({ commande }: { commande: Commande }) {
  const mode = MODES[commande.type_commande] ?? MODES.A_emporter;
  const Icone = mode.icone;

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div className="rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gris-700">Informations</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gris-500">Mode de réception</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-medium text-gris-700">
              <Icone size={16} aria-hidden className="text-primaire" />
              {mode.libelle}
            </dd>
          </div>
          {commande.contact_invite !== null && (
            <div>
              <dt className="text-gris-500">Nous vous contacterons au</dt>
              <dd className="mt-0.5 font-medium text-gris-700">
                {commande.contact_invite}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-gris-700">
          <UserPlus size={18} aria-hidden className="text-succes" />
          Commandez plus simplement
        </p>
        <p className="mt-1 text-sm text-gris-500">
          Avec un compte, vos commandes sont regroupées dans « Mes commandes », sans
          référence à conserver.
        </p>
        <Link
          to="/inscription"
          className="mt-3 inline-block text-sm font-semibold text-primaire no-underline hover:underline"
        >
          Créer un compte
        </Link>
      </div>

      <Link
        to="/produits"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white no-underline shadow-md transition-all hover:-translate-y-0.5 hover:bg-action-fonce"
      >
        <ShoppingBag size={18} aria-hidden />
        Continuer mes achats
      </Link>
    </aside>
  );
}
