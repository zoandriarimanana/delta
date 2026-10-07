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

import { Link } from 'react-router';
import {
  Banknote,
  ChevronRight,
  Store,
  Truck,
  UserRound,
  UserRoundPlus,
  UtensilsCrossed,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';

import {
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

export default function LigneCommandeAdministration({
  commande,
}: {
  commande: Commande;
}) {
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
      }`}
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
      </td>

      <td className="px-2.5 py-3">
        <div className="flex flex-col items-start gap-1">
          <Badge variante={varianteStatutCommande(commande.statut)}>
            {libelleStatutCommande(commande.statut)}
          </Badge>
          {commande.rembourse_le !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-attente">
              <Banknote size={13} aria-hidden />
              Remboursée
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
