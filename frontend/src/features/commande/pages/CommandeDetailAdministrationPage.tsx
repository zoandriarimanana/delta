/**
 * Fiche d'une commande, administration (Sprint 10.6).
 *
 * Quatre actions, chacune ses propres conditions d'apparition :
 *
 * - **Faire avancer** (13 octobre 2026) — un bouton dont le libellé dit
 *   l'étape : « Confirmer la commande » (payée en espèces, par exemple),
 *   « Mettre en préparation », puis « Marquer servie » ou « Marquer remise
 *   au client ». Une commande à livrer s'arrête à la préparation : sa fin
 *   vient de la livraison (`etapeAdministration`).
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

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  Archive,
  Banknote,
  CheckCircle2,
  RotateCcw,
  MapPin,
  RotateCw,
  Store,
  Truck,
  UserRound,
  UserRoundPlus,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import RecapitulatifCommande from '../components/RecapitulatifCommande';
import {
  etapeAdministration,
  formaterDate,
  libelleModeReception,
  libelleStatutCommande,
  varianteStatutCommande,
} from '../commande.service';
import type { TypeCommande } from '../commande.types';

const ICONES_MODE: Record<TypeCommande, typeof Truck> = {
  En_ligne: Truck,
  A_emporter: Store,
  Sur_place: UtensilsCrossed,
};
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
  // L'annulation est irréversible : elle se confirme en deux temps.
  const [confirmation, setConfirmation] = useState(false);
  const relance = useActionRelanceLivraison(() => {
    livraisonEchouee.recharger();
    detail.recharger();
  });

  if (detail.chargement) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }

  if (detail.commande === null) {
    return (
      <p
        role="alert"
        className="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
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
  const etape = etapeAdministration(commande);

  const IconeMode = ICONES_MODE[commande.type_commande] ?? Truck;
  const invite = commande.id_client === null;

  return (
    <section className="mx-auto max-w-5xl">
      <Link
        to="/personnel/commandes/administration"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primaire no-underline hover:underline"
      >
        <ArrowLeft size={16} aria-hidden />
        Retour à la liste
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gris-700">
          Commande n° {commande.id_commande}
        </h1>
        <Badge variante={varianteStatutCommande(commande.statut)}>
          {libelleStatutCommande(commande.statut)}
        </Badge>
        {commande.rembourse_le !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-attente/15 px-3 py-1 text-sm font-medium text-attente">
            <Banknote size={14} aria-hidden />
            Remboursée
          </span>
        )}
      </div>

      <time
        dateTime={commande.date_commande}
        className="mt-1 block text-sm text-gris-500"
      >
        Passée le {formaterDate(commande.date_commande)}
      </time>

      {commande.supprime_le != null && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gris-300 bg-gris-100 p-4">
          <p className="flex items-center gap-2 text-sm text-gris-700">
            <Archive size={16} aria-hidden />
            Commande supprimée de la liste (archivée). Elle reste conservée avec ses
            paiements et sa livraison.
          </p>
          <Bouton
            variante="valider"
            icone={RotateCcw}
            onClick={() => void actions.restaurer()}
            disabled={actions.envoi}
          >
            Restaurer
          </Bouton>
        </div>
      )}

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {actions.erreur}
        </p>
      )}

      {relance.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {relance.erreur}
        </p>
      )}

      {commande.rembourse_le !== null && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-attente/30 bg-attente/10 p-3 text-sm text-gris-700">
          <Banknote size={16} aria-hidden className="text-attente" />
          Remboursée le {formaterDate(commande.rembourse_le)}.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Encart titre="Client" icone={invite ? UserRoundPlus : UserRound}>
          {invite ? (
            <>
              <p className="font-medium text-gris-700">
                {commande.nom_invite ?? 'Invité'}
              </p>
              <p className="text-sm text-gris-500">
                Commande sans compte
                {commande.contact_invite ? ` · ${commande.contact_invite}` : ''}
              </p>
            </>
          ) : (
            <p className="font-medium text-gris-700">Client n° {commande.id_client}</p>
          )}
        </Encart>
        <Encart titre="Réception" icone={IconeMode}>
          <p className="font-medium text-gris-700">
            {libelleModeReception(commande.type_commande)}
          </p>
          {commande.adresse_livraison != null && (
            <p className="mt-0.5 flex items-start gap-1 text-sm text-gris-500">
              <MapPin size={14} aria-hidden className="mt-0.5 shrink-0" />
              {commande.adresse_livraison}
            </p>
          )}
        </Encart>
      </div>

      <div className="mt-4 rounded-2xl border border-gris-200 bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gris-700">Articles</h2>
        <RecapitulatifCommande commande={commande} afficherStatut={false} />
      </div>

      <div className="mt-4 rounded-2xl border border-gris-200 bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gris-700">Actions</h2>
        {confirmation ? (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm font-medium text-danger">
              Annuler cette commande ? Une commande annulée ne peut plus changer de
              statut.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Bouton
                variante="danger"
                icone={X}
                onClick={() => {
                  setConfirmation(false);
                  void actions.annuler();
                }}
                disabled={actions.envoi}
              >
                Confirmer l’annulation
              </Bouton>
              <Bouton variante="neutre" onClick={() => setConfirmation(false)}>
                Garder la commande
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {etape?.type === 'action' && (
              <Bouton
                variante="valider"
                icone={CheckCircle2}
                onClick={() => void actions.avancer()}
                disabled={actions.envoi}
              >
                {etape.libelle}
              </Bouton>
            )}
            {livraisonEchouee.livraison !== null && (
              <Bouton
                variante="primaire"
                icone={RotateCw}
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
              variante="attention"
              icone={Banknote}
              onClick={() => void actions.rembourser()}
              disabled={actions.envoi}
            >
              Marquer remboursée
            </Bouton>
            {peutAnnuler && (
              <Bouton
                variante="danger-contour"
                icone={X}
                onClick={() => setConfirmation(true)}
                disabled={actions.envoi}
              >
                Annuler
              </Bouton>
            )}
          </div>
        )}
        {etape?.type === 'livraison' && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-gris-600">
            <Truck size={15} aria-hidden className="mt-0.5 shrink-0 text-primaire" />
            Commande à livrer : elle passera « Livrée » quand sa livraison sera marquée
            livrée.
          </p>
        )}
        <p className="mt-3 text-xs text-gris-500">
          « Marquer remboursée » ne fait que noter le remboursement : l’argent se rend
          hors du site (espèces, virement).
        </p>
      </div>
    </section>
  );
}

function Encart({
  titre,
  icone: Icone,
  children,
}: {
  titre: string;
  icone: typeof Truck;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-gris-200 bg-surface p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
        <Icone size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gris-500">
          {titre}
        </p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
