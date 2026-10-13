/**
 * Une ligne du tableau d'administration des commandes.
 *
 * Ce que l'administrateur doit lire d'un coup d'œil : **quoi** (vignettes et
 * nom des produits), **pour qui** — un client inscrit **ou un invité, nommé
 * avec son contact** : ces deux champs étaient renvoyés par l'API sans être
 * affichés nulle part (dette relevée par l'inspection QA, section 3) —,
 * **comment** (mode de réception), **combien**, et **où en est-elle**
 * (pastille colorée, remboursement signalé à part).
 *
 * Le numéro de commande est le lien vers la fiche. Aucune action en ligne : les trois actions d'une commande ont chacune leurs
 * conditions et vivent sur la fiche (cf. `AdministrationCommandesPage`).
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  Archive,
  Banknote,
  ChevronRight,
  RotateCcw,
  Trash2,
  Store,
  Truck,
  UserRound,
  UserRoundPlus,
  UtensilsCrossed,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import { montantAPayer } from '@/features/devise/devise.service';

import {
  estTerminee,
  formaterMontant,
  libelleModeReception,
  libelleStatutCommande,
  varianteStatutCommande,
} from '../commande.service';
import type { Commande, TypeCommande } from '../commande.types';
import VignetteProduit from './VignetteProduit';

/** Libellé court du mode, pour tenir dans une colonne de tableau. */
const MODES_COURTS: Record<TypeCommande, string> = {
  En_ligne: 'Livraison',
  A_emporter: 'Retrait',
  Sur_place: 'Sur place',
};

const ICONES_MODE: Record<TypeCommande, typeof Truck> = {
  En_ligne: Truck,
  A_emporter: Store,
  Sur_place: UtensilsCrossed,
};

/** Date courte, sur une ligne : « 9 sept. 2026, 10:39 ». */
const FORMAT_COURT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Vignettes montrées au plus ; le reste est résumé par « +n ». */
const VIGNETTES_MAX = 2;

interface Proprietes {
  commande: Commande;
  /** Supprimer = archiver (jamais d'effacement réel), puis restaurer. */
  surArchiver: (idCommande: number) => void;
  surRestaurer: (idCommande: number) => void;
  envoi: boolean;
}

export default function LigneCommandeAdministration({
  commande,
  surArchiver,
  surRestaurer,
  envoi,
}: Proprietes) {
  const [confirmation, setConfirmation] = useState(false);
  const archivee = commande.supprime_le != null;
  // Une commande en cours a encore quelque chose à faire : la supprimer de
  // la liste la ferait oublier. Le serveur le refuse aussi (409).
  const supprimable =
    !archivee && (commande.statut === 'Annulee' || estTerminee(commande));
  const IconeMode = ICONES_MODE[commande.type_commande] ?? Truck;
  const aTraiter = commande.statut === 'En_attente';
  const articles = commande.lignes.reduce((total, l) => total + l.quantite, 0);
  const premiers = commande.lignes.slice(0, VIGNETTES_MAX);
  const reste = commande.lignes.length - premiers.length;
  const resume = commande.lignes.map((l) => l.nom_produit).join(', ');

  return (
    <tr
      className={`align-middle transition-colors hover:bg-gris-100/60 ${
        aTraiter ? 'bg-attente/5' : ''
      } ${archivee ? 'opacity-60' : ''}`}
    >
      <td
        className={`border-l-4 px-3 py-3 ${
          aTraiter ? 'border-attente' : 'border-transparent'
        }`}
      >
        <Link
          to={`/personnel/commandes/administration/${commande.id_commande}`}
          className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-primaire no-underline hover:underline"
        >
          Commande n° {commande.id_commande}
          <ChevronRight size={15} aria-hidden />
        </Link>
        <p className="whitespace-nowrap text-xs text-gris-500">
          {FORMAT_COURT.format(new Date(commande.date_commande))}
        </p>
      </td>

      <td className="px-2.5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 -space-x-3">
            {premiers.map((ligne) => (
              <VignetteProduit
                key={ligne.id_ligne}
                idProduit={ligne.id_produit}
                nom={ligne.nom_produit}
                className="h-10 w-10 rounded-lg ring-2 ring-surface"
              />
            ))}
            {reste > 0 && (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gris-200 text-xs font-semibold text-gris-600 ring-2 ring-surface">
                +{reste}
              </span>
            )}
          </div>
          <div className="w-36">
            <p className="truncate text-sm text-gris-700" title={resume}>
              {resume || '—'}
            </p>
            <p className="text-xs text-gris-500">
              {articles} article{articles > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </td>

      <td className="px-2.5 py-3 text-sm">
        {commande.id_client !== null ? (
          <p className="whitespace-nowrap text-gris-700">
            <UserRound
              size={15}
              aria-hidden
              className="mr-1.5 inline-block align-[-2px] text-gris-400"
            />
            Client n° {commande.id_client}
          </p>
        ) : (
          <>
            <p className="whitespace-nowrap text-gris-700">
              <UserRoundPlus
                size={15}
                aria-hidden
                className="mr-1.5 inline-block align-[-2px] text-gris-400"
              />
              {commande.nom_invite ?? 'Invité'}
            </p>
            <p className="max-w-[11rem] break-all text-xs text-gris-500">
              Invité{commande.contact_invite ? ` · ${commande.contact_invite}` : ''}
            </p>
          </>
        )}
      </td>

      <td className="whitespace-nowrap px-2.5 py-3 text-sm text-gris-700">
        <IconeMode
          size={15}
          aria-hidden
          className="mr-1.5 inline-block align-[-2px] text-gris-400"
        />
        <span title={libelleModeReception(commande.type_commande)}>
          {MODES_COURTS[commande.type_commande] ?? commande.type_commande}
        </span>
      </td>

      <td className="whitespace-nowrap px-2.5 py-3 text-right font-semibold text-gris-700">
        {formaterMontant(commande.montant_total)}
        {commande.devise !== undefined && commande.devise !== 'MGA' && (
          <span className="block text-xs font-medium text-primaire">
            payée en {montantAPayer(commande)}
          </span>
        )}
      </td>

      <td className="px-2.5 py-3">
        <div className="flex flex-col items-start gap-1">
          <Badge variante={varianteStatutCommande(commande.statut)}>
            {/* « À confirmer », le libellé du compteur de l'écran : le libellé
                complet débordait de la dernière colonne du tableau. */}
            {commande.statut === 'En_attente'
              ? 'À confirmer'
              : libelleStatutCommande(commande.statut)}
          </Badge>
          {commande.rembourse_le !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-attente">
              <Banknote size={13} aria-hidden />
              Remboursée
            </span>
          )}
        </div>
      </td>

      {/* `relative` : la confirmation s'affiche en bulle par-dessus la fin de
          la ligne, sans élargir la colonne — elle était coupée par le cadre
          défilant du tableau. */}
      <td className="relative whitespace-nowrap px-2.5 py-3 pr-4 text-right">
        {archivee ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gris-500">
              <Archive size={13} aria-hidden />
              Archivée
            </span>
            <button
              type="button"
              onClick={() => surRestaurer(commande.id_commande)}
              disabled={envoi}
              className="inline-flex items-center gap-1 rounded-lg border border-succes/40 px-2 py-1 text-xs font-semibold text-succes hover:bg-succes/10 disabled:opacity-50"
            >
              <RotateCcw size={13} aria-hidden />
              Restaurer
            </button>
          </span>
        ) : confirmation ? (
          <span
            role="group"
            aria-label={`Confirmer la suppression de la commande n° ${commande.id_commande}`}
            className="absolute right-2 top-1/2 z-10 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-xl border border-danger/30 bg-surface px-3 py-2 shadow-lg"
          >
            <span className="text-xs font-medium text-danger">Supprimer ?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmation(false);
                surArchiver(commande.id_commande);
              }}
              disabled={envoi}
              className="rounded-lg bg-danger px-2 py-1 text-xs font-semibold text-sur-couleur hover:opacity-90 disabled:opacity-50"
            >
              Oui
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              className="rounded-lg border border-gris-300 px-2 py-1 text-xs font-semibold text-gris-600 hover:bg-gris-100"
            >
              Non
            </button>
          </span>
        ) : supprimable ? (
          <button
            type="button"
            onClick={() => setConfirmation(true)}
            aria-label={`Supprimer la commande n° ${commande.id_commande}`}
            title="Supprimer (archiver) cette commande"
            className="rounded-lg p-1.5 text-gris-400 transition hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={17} aria-hidden />
          </button>
        ) : null}
      </td>
    </tr>
  );
}
