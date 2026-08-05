/**
 * Hooks du module livraison : état, effets, et rien de visuel.
 */

import { useEffect, useState } from 'react';

import { recupererSuivi, recupererSuiviInvite } from './livraison.api';
import type { SuiviLivraison } from './livraison.types';

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
