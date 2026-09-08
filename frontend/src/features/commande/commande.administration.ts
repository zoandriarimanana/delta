/**
 * Hooks et règles de l'administration des commandes (Sprint 10.6).
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible (cf. `personnel.administration.ts`,
 * `reservation.administration.ts`, même traitement).
 *
 * **Aucune archivage ici, contrairement à PERSONNEL.** Ni `annuler` ni
 * `rembourser` ne posent `supprime_le` : la commande reste visible de
 * `GET /commandes/administration/{id}` après l'une ou l'autre action, donc la
 * fiche peut simplement recharger depuis le serveur plutôt que de garder un
 * état local (cf. `PersonnelDetailAdministrationPage`, dont c'est la
 * contrainte inverse).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  annulerCommandeAdministration,
  obtenirCommandeAdministration,
  recupererCommandesAdministration,
  rembourserCommandeAdministration,
} from './commande.api';
import type { Commande } from './commande.types';
import {
  recupererLivraisonsAdministration,
  relancerLivraison,
} from '@/features/livraison/livraison.api';
import type { LivraisonAdministration } from '@/features/livraison/livraison.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Le **403** est le cas propre à ces écrans : un salarié sans droit voit
 * l'écran (l'authentification de personnel suffit à y accéder par le menu)
 * mais se voit refuser l'écriture. Le **409** (déjà annulée, déjà au statut
 * terminal) est repris tel quel : il dit exactement ce qui bloque.
 */
export function messageDAdministration(erreur: unknown): string {
  const reponse = (
    erreur as { response?: { status?: number; data?: { detail?: unknown } } } | null
  )?.response;

  if (reponse?.status === 403) {
    return 'Cette action est réservée aux administrateurs.';
  }

  const detail = reponse?.data?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : MESSAGE_PAR_DEFAUT;
}

export interface CommandesAdministration {
  commandes: Commande[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/** Toutes les commandes, tous clients confondus. */
export function useCommandesAdministration(): CommandesAdministration {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    recupererCommandesAdministration()
      .then((donnees) => actif && setCommandes(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { commandes, chargement, erreur, recharger };
}

export interface CommandeDetailAdministration {
  commande: Commande | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/** Fiche d'une commande — lecture seule, rechargeable après chaque action. */
export function useCommandeDetailAdministration(
  idCommande: number
): CommandeDetailAdministration {
  const [commande, setCommande] = useState<Commande | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    obtenirCommandeAdministration(idCommande)
      .then((donnees) => actif && setCommande(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [idCommande, jeton]);

  return { commande, chargement, erreur, recharger };
}

export interface ActionsCommandeAdministration {
  annuler: () => Promise<boolean>;
  rembourser: () => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/** Annuler / marquer remboursée, depuis la fiche d'une commande. */
export function useActionsCommandeAdministration(
  idCommande: number,
  recharger: () => void
): ActionsCommandeAdministration {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const executer = useCallback(
    async (action: (id: number) => Promise<Commande>): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await action(idCommande);
        recharger();
        return true;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [idCommande, recharger]
  );

  return {
    annuler: () => executer(annulerCommandeAdministration),
    rembourser: () => executer(rembourserCommandeAdministration),
    envoi,
    erreur,
  };
}

export interface LivraisonEchoueeDeLaCommande {
  livraison: LivraisonAdministration | null;
  chargement: boolean;
  recharger: () => void;
}

/**
 * La livraison `Echouee` de cette commande, s'il y en a une.
 *
 * `GET /livraisons/{id}` n'existe pas par commande : l'endpoint n'expose
 * qu'une liste filtrable par statut (10.4). Comme le bouton « Relancer » n'a
 * de sens que sur une livraison `Echouee`, filtrer côté client sur ce seul
 * statut suffit — et ne demande jamais la liste complète des livraisons.
 */
export function useLivraisonEchoueeDeLaCommande(
  idCommande: number
): LivraisonEchoueeDeLaCommande {
  const [livraison, setLivraison] = useState<LivraisonAdministration | null>(null);
  const [chargement, setChargement] = useState(true);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);

    recupererLivraisonsAdministration('Echouee')
      .then((donnees) => {
        if (actif) {
          setLivraison(donnees.find((l) => l.id_commande === idCommande) ?? null);
        }
      })
      .catch(() => actif && setLivraison(null))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [idCommande, jeton]);

  return { livraison, chargement, recharger };
}

export interface ActionRelanceLivraison {
  relancer: (idLivraison: number) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/** Relance la livraison échouée d'une commande, depuis sa fiche. */
export function useActionRelanceLivraison(
  recharger: () => void
): ActionRelanceLivraison {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const relancer = useCallback(
    async (idLivraison: number): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await relancerLivraison(idLivraison);
        recharger();
        return true;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [recharger]
  );

  return { relancer, envoi, erreur };
}
