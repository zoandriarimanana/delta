/**
 * Formulaire de paiement d'une commande déjà créée.
 *
 * Vit dans `features/paiement/`, jamais dans `commande/` : c'est une écriture
 * sur `PAIEMENT`, entité à part entière, initiée depuis un écran **séparé**
 * du tunnel de commande (cf. `docs/mld.md`, Sprint 9 — décision actée pour
 * isoler le risque de la simulation du tunnel déjà stable). L'historique des
 * commandes monte ce composant sans rien savoir de son implémentation, même
 * mécanique que `FormulaireAvis`.
 *
 * **Ouverture internationale** : deux choix, et non plus deux listes
 * indépendantes qui laissaient composer « Carte » + « MVola ». La carte
 * bancaire internationale (Visa, Mastercard, American Express) passe par
 * Stripe ; le mobile money par un opérateur malgache, et **seulement en
 * Ariary** — le serveur le refuse en 422 pour une commande en devise, le
 * choix est donc désactivé ici plutôt que découvert après coup.
 *
 * Le bouton « Simuler la confirmation » est masqué hors
 * `VITE_ENVIRONMENT=developpement` — **confort d'affichage seulement** : un
 * clic hors développement échouerait de toute façon en 404, identique à un
 * paiement introuvable, derrière `Settings.ENVIRONMENT` côté serveur (cf.
 * `docs/mld.md`). Sans ce masquage, un client verrait un bouton qui échoue
 * silencieusement — l'impression d'une fonctionnalité cassée plutôt
 * qu'intentionnellement absente. La seule vraie garantie reste le 404
 * backend ; ce masquage ne protège rien à lui seul.
 */

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Smartphone } from 'lucide-react';

import type { Devise } from '@/features/devise/devise.types';
import { useTextes } from '@/lib/langue';
import { useEstConnecte } from '@/lib/useEstConnecte';

import { TEXTES_PAIEMENT } from '../paiement.textes';
import { usePaiement } from '../paiement.hooks';
import type { FournisseurPaiement, MethodePaiement } from '../paiement.types';

interface Proprietes {
  idCommande: number;
  /** Devise de la commande : hors Ariary, seule la carte est possible. */
  devise?: Devise;
  /** Montant à payer, déjà mis en forme dans la devise de la commande. */
  montant?: string;
  /**
   * Appelé une fois le paiement confirmé `Reussi` — permet à l'historique de
   * recharger ses commandes pour refléter `COMMANDE.statut` (`Confirmee`),
   * que ce composant ne connaît pas lui-même : il n'affiche que le paiement.
   */
  onConfirme?: () => void;
}

/** Opérateurs mobile money — la carte, elle, passe toujours par Stripe. */
const OPERATEURS: FournisseurPaiement[] = ['Mvola', 'Orange_money', 'Airtel_money'];

/** Nom commercial de chaque fournisseur — la valeur du domaine reste technique. */
const NOMS_FOURNISSEURS: Record<FournisseurPaiement, string> = {
  Mvola: 'MVola',
  Orange_money: 'Orange Money',
  Airtel_money: 'Airtel Money',
  Stripe: 'Stripe',
};

/** Lu à chaque rendu, jamais figé au chargement du module : voir le test qui
 * bascule cette variable d'un rendu à l'autre via `vi.stubEnv`. */
function simulationActive(): boolean {
  return import.meta.env.VITE_ENVIRONMENT === 'developpement';
}

export default function FormulairePaiement({
  idCommande,
  devise = 'MGA',
  montant,
  onConfirme,
}: Proprietes) {
  const t = useTextes(TEXTES_PAIEMENT);
  const connecte = useEstConnecte();
  const { paiement, envoi, erreur, initier, simuler } = usePaiement();
  const enAriary = devise === 'MGA';
  const [methode, setMethode] = useState<MethodePaiement>(
    enAriary ? 'Mobile_money' : 'Carte'
  );
  const [operateur, setOperateur] = useState<FournisseurPaiement>('Mvola');
  const fournisseur: FournisseurPaiement = methode === 'Carte' ? 'Stripe' : operateur;

  // `onConfirme` déclenche un rechargement chez l'appelant (l'historique) —
  // un effet de bord qui ne doit pas s'exécuter pendant le rendu de ce
  // composant, d'où le `useEffect`. `idDejaNotifie` évite de le rappeler à
  // chaque rendu tant que le paiement reste `Reussi` : sans lui, un
  // `onConfirme` non mémoïsé par l'appelant (identité recréée à chaque
  // rendu) redéclencherait l'effet indéfiniment — le rechargement qu'il
  // provoque re-rend l'historique, qui recrée la fonction, qui redéclenche
  // l'effet.
  const idDejaNotifie = useRef<number | null>(null);
  useEffect(() => {
    if (
      paiement?.statut === 'Reussi' &&
      idDejaNotifie.current !== paiement.id_paiement
    ) {
      idDejaNotifie.current = paiement.id_paiement;
      onConfirme?.();
    }
  }, [paiement, onConfirme]);

  // Un visiteur non connecté n'émet aucun appel : il recevrait un 401, qui
  // effacerait le jeton et déclencherait une redirection — même garde que
  // `FormulaireAvis`. En pratique ce composant n'apparaît que dans un
  // historique déjà réservé au client connecté, mais la garde reste là où
  // elle protège, pas seulement là où elle sert aujourd'hui.
  if (!connecte) {
    return null;
  }

  if (paiement === null) {
    return (
      <form
        className="mt-3 space-y-3 rounded-xl border border-gris-200 bg-surface p-4"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void initier(idCommande, { methode, fournisseur });
        }}
      >
        {montant !== undefined && (
          <p className="text-sm text-gris-600">
            {t.montantAPayer}{' '}
            <span className="font-semibold text-gris-700">{montant}</span>
          </p>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-gris-700">
            {t.moyenPaiement}
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <ChoixMethode
              actif={methode === 'Carte'}
              surChoix={() => setMethode('Carte')}
              icone={CreditCard}
              titre={t.carte}
              detail={t.carteDetail}
            />
            <ChoixMethode
              actif={methode === 'Mobile_money'}
              surChoix={() => setMethode('Mobile_money')}
              icone={Smartphone}
              titre={t.mobileMoney}
              detail={enAriary ? t.mobileMoneyDetail : t.ariaryUniquement}
              desactive={!enAriary}
            />
          </div>
        </fieldset>

        {methode === 'Mobile_money' && (
          <label className="flex items-center gap-2 text-sm text-gris-700">
            {t.operateur}
            <select
              value={operateur}
              onChange={(evenement) =>
                setOperateur(evenement.target.value as FournisseurPaiement)
              }
              className="rounded-lg border border-gris-300 bg-surface px-2 py-1.5"
            >
              {OPERATEURS.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {NOMS_FOURNISSEURS[valeur]}
                </option>
              ))}
            </select>
          </label>
        )}

        {erreur !== null && (
          // Repris tel quel : « cette commande est annulée » ou « cette
          // commande a déjà été payée » disent quoi corriger — même
          // traitement que `FormulaireAvis`.
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
          >
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="rounded-full bg-action px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-action-fonce disabled:opacity-50"
        >
          {envoi ? t.envoi : t.payer}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-gris-200 bg-surface p-3">
      <p className="text-sm text-gris-700">
        {t.statutPaiement} {t.statuts[paiement.statut] ?? paiement.statut}
      </p>

      {erreur !== null && (
        <p
          role="alert"
          className="rounded border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
        >
          {erreur}
        </p>
      )}

      {paiement.statut === 'En_attente' && simulationActive() && (
        <button
          type="button"
          onClick={() => void simuler()}
          disabled={envoi}
          className="rounded border border-gris-300 px-3 py-1.5 text-sm text-gris-700 disabled:opacity-50"
        >
          {envoi ? t.envoi : t.simuler}
        </button>
      )}

      {paiement.statut === 'Reussi' && (
        <p role="status" className="text-sm text-succes">
          {t.merci}
        </p>
      )}
    </div>
  );
}

function ChoixMethode({
  actif,
  surChoix,
  icone: Icone,
  titre,
  detail,
  desactive = false,
}: {
  actif: boolean;
  surChoix: () => void;
  icone: typeof CreditCard;
  titre: string;
  detail: string;
  desactive?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
        desactive
          ? 'cursor-not-allowed border-gris-200 opacity-60'
          : actif
            ? 'cursor-pointer border-primaire bg-primaire/5'
            : 'cursor-pointer border-gris-200 hover:border-gris-300'
      }`}
    >
      <input
        type="radio"
        name="methode-paiement"
        checked={actif}
        disabled={desactive}
        onChange={surChoix}
        className="sr-only"
      />
      <Icone
        size={20}
        aria-hidden
        className={actif ? 'mt-0.5 text-primaire' : 'mt-0.5 text-gris-500'}
      />
      <span>
        <span className="block text-sm font-semibold text-gris-700">{titre}</span>
        <span className="block text-xs text-gris-500">{detail}</span>
      </span>
    </label>
  );
}
