/**
 * Hooks du module commande : état, effets, et rien de visuel.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import {
  creerCommande,
  creerCommandeInvite,
  recupererCommandeInvitee,
  recupererHistorique,
} from './commande.api';
import {
  abonnerAuPanier,
  ecrirePanier,
  lirePanier,
  resynchroniserPanier,
  viderPanier,
} from './commande.panier';
import {
  ajouterAuPanier,
  modifierQuantite,
  nombreArticles,
  retirerDuPanier,
  totalPanier,
  versLignesEnvoyees,
} from './commande.service';
import type { Commande, LignePanier, TypeCommande } from './commande.types';
import type { Produit } from '@/features/produit/produit.types';

const MESSAGE_ERREUR_PAR_DEFAUT =
  'La commande n’a pas pu être enregistrée. Réessayez dans un instant.';

export interface Panier {
  lignes: LignePanier[];
  nombre: number;
  total: number;
  ajouter: (produit: Produit, quantite?: number) => void;
  modifier: (idProduit: number, quantite: number) => void;
  retirer: (idProduit: number) => void;
  vider: () => void;
}

/**
 * Panier partagé par toute l'application.
 *
 * `useSyncExternalStore` fait que le compteur de la barre de navigation et la
 * page panier lisent le même état, sans fournisseur enveloppant l'application.
 *
 * C'est aussi ce hook que le layout consomme pour afficher son compteur : la
 * donnée métier vient du module, elle n'est jamais écrite en dur dans
 * `layouts/` (cf. `docs/architecture.md`).
 */
export function usePanier(): Panier {
  const lignes = useSyncExternalStore(abonnerAuPanier, lirePanier, lirePanier);

  useEffect(() => {
    // Un autre onglet a modifié le panier : sans cette resynchronisation, les
    // deux vues divergeraient silencieusement.
    window.addEventListener('storage', resynchroniserPanier);
    return () => window.removeEventListener('storage', resynchroniserPanier);
  }, []);

  return {
    lignes,
    nombre: nombreArticles(lignes),
    total: totalPanier(lignes),
    ajouter: useCallback(
      (produit: Produit, quantite = 1) =>
        ecrirePanier(ajouterAuPanier(lirePanier(), produit, quantite)),
      []
    ),
    modifier: useCallback(
      (idProduit: number, quantite: number) =>
        ecrirePanier(modifierQuantite(lirePanier(), idProduit, quantite)),
      []
    ),
    retirer: useCallback(
      (idProduit: number) => ecrirePanier(retirerDuPanier(lirePanier(), idProduit)),
      []
    ),
    vider: useCallback(viderPanier, []),
  };
}

export interface ValidationCommande {
  valider: (
    type: TypeCommande,
    invite?: { nom_invite: string; contact_invite: string }
  ) => Promise<Commande | null>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Validation du panier en commande.
 *
 * Le panier n'est vidé **qu'en cas de succès** : un échec réseau ou un stock
 * devenu insuffisant ne doit jamais faire perdre sa sélection au client.
 *
 * Le message d'erreur du serveur est repris quand il existe — « stock
 * insuffisant » est une information utile, contrairement à une trace technique.
 */
export function useValidationCommande(): ValidationCommande {
  const panier = usePanier();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = useCallback(
    async (
      type: TypeCommande,
      invite?: { nom_invite: string; contact_invite: string }
    ): Promise<Commande | null> => {
      setEnvoi(true);
      setErreur(null);
      const lignes = versLignesEnvoyees(lirePanier());

      try {
        const commande =
          invite === undefined
            ? await creerCommande({ type_commande: type, lignes })
            : await creerCommandeInvite({
                type_commande: type,
                lignes,
                ...invite,
              });
        panier.vider();
        return commande;
      } catch (erreurAppel) {
        setErreur(messageDErreur(erreurAppel));
        return null;
      } finally {
        setEnvoi(false);
      }
    },
    [panier]
  );

  return { valider, envoi, erreur };
}

/** Extrait le message métier de l'API, ou retombe sur un message générique. */
function messageDErreur(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' ? detail : MESSAGE_ERREUR_PAR_DEFAUT;
}

export interface EtatCommande {
  commande: Commande | null;
  chargement: boolean;
  erreur: string | null;
}

/** Lecture publique d'une commande invitée, par sa référence. */
export function useCommandeInvitee(reference: string | null): EtatCommande {
  const [etat, setEtat] = useState<EtatCommande>({
    commande: null,
    chargement: reference !== null,
    erreur: null,
  });

  useEffect(() => {
    if (reference === null) {
      setEtat({ commande: null, chargement: false, erreur: null });
      return;
    }

    let actif = true;
    setEtat({ commande: null, chargement: true, erreur: null });

    recupererCommandeInvitee(reference)
      .then((commande) => {
        if (actif) {
          setEtat({ commande, chargement: false, erreur: null });
        }
      })
      .catch(() => {
        if (actif) {
          setEtat({
            commande: null,
            chargement: false,
            erreur: 'Cette commande est introuvable.',
          });
        }
      });

    return () => {
      actif = false;
    };
  }, [reference]);

  return etat;
}

export interface EtatHistorique {
  commandes: Commande[];
  chargement: boolean;
  erreur: string | null;
}

/**
 * Historique du client connecté, du plus récent au plus ancien.
 *
 * Aucune requête n'est émise sans jeton : elle serait refusée en 401, ce qui
 * effacerait le jeton et déclencherait une redirection — un effet de bord
 * absurde pour un visiteur qui n'était simplement pas connecté.
 *
 * Le tri vient du serveur ; le refaire ici masquerait une régression côté API.
 */
export function useHistorique(actif: boolean): EtatHistorique {
  const [etat, setEtat] = useState<EtatHistorique>({
    commandes: [],
    chargement: actif,
    erreur: null,
  });

  useEffect(() => {
    if (!actif) {
      setEtat({ commandes: [], chargement: false, erreur: null });
      return;
    }

    let enCours = true;
    setEtat({ commandes: [], chargement: true, erreur: null });

    recupererHistorique()
      .then((commandes) => {
        if (enCours) {
          setEtat({ commandes, chargement: false, erreur: null });
        }
      })
      .catch(() => {
        if (enCours) {
          setEtat({
            commandes: [],
            chargement: false,
            erreur: 'Vos commandes n’ont pas pu être chargées.',
          });
        }
      });

    return () => {
      enCours = false;
    };
  }, [actif]);

  return etat;
}
