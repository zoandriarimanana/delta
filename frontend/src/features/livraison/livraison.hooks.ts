/**
 * Hooks du module livraison : état, effets, et rien de visuel.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  recupererSuivi,
  recupererSuiviInvite,
  recupererTarifLivraison,
} from './livraison.api';
import type { SuiviLivraison, TarifLivraison } from './livraison.types';

export interface EtatSuivi {
  suivi: SuiviLivraison | null;
  chargement: boolean;
  /**
   * `true` quand la commande existe mais n'a **pas** de livraison — retrait sur
   * place. Ce n'est pas une erreur : la page n'affiche simplement rien.
   */
  sansLivraison: boolean;
  erreur: string | null;
}

const ETAT_VIDE: EtatSuivi = {
  suivi: null,
  chargement: false,
  sansLivraison: false,
  erreur: null,
};

/**
 * Charge un suivi, par l'un des deux chemins.
 *
 * `actif` à `false` n'émet aucune requête : une commande dont on ne sait pas
 * encore si elle existe, ou un visiteur non connecté, ne doit pas produire un
 * 401 qui effacerait le jeton et déclencherait une redirection.
 *
 * Le 404 est traité **à part** des autres erreurs. Il signifie « pas de
 * livraison pour cette commande » dans le cas courant, et l'afficher comme une
 * panne inquiéterait pour un retrait parfaitement normal.
 */
function useChargement(
  actif: boolean,
  charger: () => Promise<SuiviLivraison>,
  cle: string | number | null
): EtatSuivi {
  const [etat, setEtat] = useState<EtatSuivi>({ ...ETAT_VIDE, chargement: actif });

  useEffect(() => {
    if (!actif) {
      setEtat(ETAT_VIDE);
      return;
    }

    let enCours = true;
    setEtat({ ...ETAT_VIDE, chargement: true });

    charger()
      .then((suivi) => {
        if (enCours) {
          setEtat({ ...ETAT_VIDE, suivi });
        }
      })
      .catch((erreur: unknown) => {
        if (!enCours) {
          return;
        }
        const statut = (erreur as { response?: { status?: number } } | null)?.response
          ?.status;
        if (statut === 404) {
          setEtat({ ...ETAT_VIDE, sansLivraison: true });
          return;
        }
        setEtat({
          ...ETAT_VIDE,
          erreur: 'Le suivi de livraison n’a pas pu être chargé.',
        });
      });

    return () => {
      enCours = false;
    };
    // `charger` est recréée à chaque rendu par l'appelant ; la clé identifie la
    // ressource et suffit à décider quand relancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle]);

  return etat;
}

/** Suivi d'une commande du client connecté. */
export function useSuiviLivraison(idCommande: number | null): EtatSuivi {
  return useChargement(
    idCommande !== null,
    () => recupererSuivi(idCommande as number),
    idCommande
  );
}

/** Suivi d'une commande invitée, par sa référence publique. */
export function useSuiviLivraisonInvitee(reference: string | null): EtatSuivi {
  return useChargement(
    reference !== null,
    () => recupererSuiviInvite(reference as string),
    reference
  );
}

export interface EtatTarif {
  /** `null` tant qu'il n'est pas chargé, ou s'il n'a pas pu l'être. */
  tarif: TarifLivraison | null;
  chargement: boolean;
  erreur: boolean;
  recharger: () => void;
}

/**
 * Tarif de livraison en vigueur.
 *
 * Un échec n'empêche rien : la fiche produit et le tunnel restent
 * utilisables, ils taisent simplement le montant — le serveur l'appliquera
 * de toute façon à la commande.
 */
export function useTarifLivraison(): EtatTarif {
  const [tarif, setTarif] = useState<TarifLivraison | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(false);
    recupererTarifLivraison()
      .then((lu) => actif && setTarif(lu))
      .catch(() => actif && setErreur(true))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { tarif, chargement, erreur, recharger };
}
