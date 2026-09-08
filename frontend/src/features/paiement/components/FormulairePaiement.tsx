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

import { useEstConnecte } from '@/lib/useEstConnecte';

import { usePaiement } from '../paiement.hooks';
import type { FournisseurPaiement, MethodePaiement } from '../paiement.types';

interface Proprietes {
  idCommande: number;
  /**
   * Appelé une fois le paiement confirmé `Reussi` — permet à l'historique de
   * recharger ses commandes pour refléter `COMMANDE.statut` (`Confirmee`),
   * que ce composant ne connaît pas lui-même : il n'affiche que le paiement.
   */
  onConfirme?: () => void;
}

const METHODES: MethodePaiement[] = ['Carte', 'Mobile_money'];
const FOURNISSEURS: FournisseurPaiement[] = [
  'Mvola',
  'Orange_money',
  'Airtel_money',
  'Stripe',
];

const LIBELLES_STATUT: Record<string, string> = {
  En_attente: 'En attente de confirmation',
  Reussi: 'Paiement réussi',
  Echoue: 'Paiement échoué',
};

/** Lu à chaque rendu, jamais figé au chargement du module : voir le test qui
 * bascule cette variable d'un rendu à l'autre via `vi.stubEnv`. */
function simulationActive(): boolean {
  return import.meta.env.VITE_ENVIRONMENT === 'developpement';
}

export default function FormulairePaiement({ idCommande, onConfirme }: Proprietes) {
  const connecte = useEstConnecte();
  const { paiement, envoi, erreur, initier, simuler } = usePaiement();
  const [methode, setMethode] = useState<MethodePaiement>('Mobile_money');
  const [fournisseur, setFournisseur] = useState<FournisseurPaiement>('Mvola');
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
        className="mt-2 space-y-2 rounded border border-warm-gray-200 bg-white p-3"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void initier(idCommande, { methode, fournisseur });
        }}
      >
        <label className="flex items-center gap-2 text-sm text-warm-gray-700">
          Méthode
          <select
            value={methode}
            onChange={(evenement) =>
              setMethode(evenement.target.value as MethodePaiement)
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {METHODES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {valeur === 'Carte' ? 'Carte bancaire' : 'Mobile money'}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-warm-gray-700">
          Fournisseur
          <select
            value={fournisseur}
            onChange={(evenement) =>
              setFournisseur(evenement.target.value as FournisseurPaiement)
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {FOURNISSEURS.map((valeur) => (
              <option key={valeur} value={valeur}>
                {valeur.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>

        {erreur !== null && (
          // Repris tel quel : « cette commande est annulée » ou « cette
          // commande a déjà été payée » disent quoi corriger — même
          // traitement que `FormulaireAvis`.
          <p
            role="alert"
            className="rounded border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta"
          >
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="rounded bg-terracotta px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {envoi ? 'Envoi…' : 'Payer cette commande'}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-warm-gray-200 bg-white p-3">
      <p className="text-sm text-warm-gray-700">
        Statut du paiement : {LIBELLES_STATUT[paiement.statut] ?? paiement.statut}
      </p>

      {erreur !== null && (
        <p
          role="alert"
          className="rounded border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta"
        >
          {erreur}
        </p>
      )}

      {paiement.statut === 'En_attente' && simulationActive() && (
        <button
          type="button"
          onClick={() => void simuler()}
          disabled={envoi}
          className="rounded border border-warm-gray-300 px-3 py-1.5 text-sm text-warm-gray-700 disabled:opacity-50"
        >
          {envoi
            ? 'Envoi…'
            : 'Simuler la confirmation (en attendant les accès fournisseurs réels)'}
        </button>
      )}

      {paiement.statut === 'Reussi' && (
        <p role="status" className="text-sm text-sage">
          Merci, votre paiement a été confirmé.
        </p>
      )}
    </div>
  );
}
