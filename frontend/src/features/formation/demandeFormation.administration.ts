/**
 * Demandes de formation — côté administration (14 octobre 2026).
 *
 * Séparé de `demandeFormation.api.ts` côté hooks : les pages publiques
 * n'importent que l'envoi, jamais ces lectures protégées.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverDemandeFormation,
  recupererDemandesFormation,
  suivreDemandeFormation,
} from './demandeFormation.api';
import { messageDAdministration } from './formation.administration';
import type {
  DemandeFormation,
  StatutDemandeFormation,
} from './demandeFormation.types';

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemandeFormation, string> = {
  Nouvelle: 'Nouvelle',
  En_discussion: 'En discussion',
  Planifiee: 'Planifiée',
  Refusee: 'Refusée',
};

export const LIBELLES_LIEU = {
  Indifferent: 'Peu importe',
  Chez_delta: 'Chez Delta',
  En_entreprise: 'En entreprise',
} as const;

export interface DemandesFormationAdministration {
  demandes: DemandeFormation[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
  suivre: (
    idDemande: number,
    statut: StatutDemandeFormation,
    note: string | null
  ) => Promise<boolean>;
  archiver: (idDemande: number) => Promise<boolean>;
  idEnCours: number | null;
}

export function useDemandesFormationAdministration(): DemandesFormationAdministration {
  const [demandes, setDemandes] = useState<DemandeFormation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);
  const [idEnCours, setIdEnCours] = useState<number | null>(null);
  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    recupererDemandesFormation()
      .then((d) => actif && setDemandes(d))
      .catch((e) => actif && setErreur(messageDAdministration(e)))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [jeton]);

  const agir = useCallback(
    async (idDemande: number, action: () => Promise<unknown>) => {
      setIdEnCours(idDemande);
      setErreur(null);
      try {
        await action();
        recharger();
        return true;
      } catch (e) {
        setErreur(messageDAdministration(e));
        return false;
      } finally {
        setIdEnCours(null);
      }
    },
    [recharger]
  );

  return {
    demandes,
    chargement,
    erreur,
    recharger,
    suivre: (id, statut, note) =>
      agir(id, () => suivreDemandeFormation(id, { statut, note_interne: note })),
    archiver: (id) => agir(id, () => archiverDemandeFormation(id)),
    idEnCours,
  };
}
