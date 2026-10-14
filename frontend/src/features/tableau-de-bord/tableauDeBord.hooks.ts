/** Hooks du tableau de bord : état et effets, rien de visuel. */

import { useEffect, useState } from 'react';

import { recupererTableauDeBord } from './tableauDeBord.api';
import type { Periode, TableauDeBord } from './tableauDeBord.types';

const MESSAGE_PAR_DEFAUT = 'Le tableau de bord n’a pas pu être chargé.';

function message(erreur: unknown): string {
  const reponse = (erreur as { response?: { status?: number } } | null)?.response;
  if (reponse?.status === 403)
    return 'Le tableau de bord est réservé aux administrateurs.';
  return MESSAGE_PAR_DEFAUT;
}

export interface EtatTableauDeBord {
  donnees: TableauDeBord | null;
  chargement: boolean;
  erreur: string | null;
}

/** Tableau de bord de la période ; rechargé à chaque changement de période. */
export function useTableauDeBord(periode: Periode): EtatTableauDeBord {
  const [donnees, setDonnees] = useState<TableauDeBord | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);
    recupererTableauDeBord(periode)
      .then((lu) => actif && setDonnees(lu))
      .catch((e) => actif && setErreur(message(e)))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [periode]);

  return { donnees, chargement, erreur };
}
