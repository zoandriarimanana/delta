/**
 * Hooks et règles de l'administration des abonnements.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible (cf. `produit.administration.ts`, même
 * traitement).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverAbonnement,
  creerAbonnement,
  creerBeneficiaireAdministration,
  modifierAbonnement,
  recupererAbonnementAdministration,
  recupererAbonnementsAdministration,
  recupererBeneficiairesAdministration,
  recupererClientsEntrepriseAdministration,
  recupererConsommationsAdministration,
  recupererSoldeAdministration,
} from './abonnement.api';
import type {
  Abonnement,
  AbonnementEnvoye,
  AbonnementModifie,
  Beneficiaire,
  BeneficiaireEnvoye,
  ClientEntrepriseAdministration,
  ConsommationRepas,
  SoldeAbonnement,
} from './abonnement.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Les refus de ce module portent une information **actionnable** :
 * - « Cet abonnement couvre encore au moins un bénéficiaire actif… » (409) ;
 * - incohérences tarif/facturation ou dates (422).
 *
 * Les remplacer par un message générique ferait perdre exactement ce qui
 * permet de corriger. Même traitement que `produit.administration.ts`.
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

// --- Liste --------------------------------------------------------------

export interface AbonnementsAdministration {
  abonnements: Abonnement[];
  entreprises: ClientEntrepriseAdministration[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Charge les abonnements et les entreprises clientes ensemble.
 *
 * Les deux listes ensemble : la page a besoin des entreprises pour résoudre
 * `id_client_entreprise` en raison sociale, et le formulaire de création pour
 * peupler son sélecteur. Deux hooks séparés obligeraient chaque écran à les
 * recoller.
 */
export function useAbonnementsAdministration(): AbonnementsAdministration {
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [entreprises, setEntreprises] = useState<ClientEntrepriseAdministration[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    Promise.all([
      recupererAbonnementsAdministration(),
      recupererClientsEntrepriseAdministration(),
    ])
      .then(([a, e]) => {
        if (!actif) return;
        setAbonnements(a);
        setEntreprises(e);
      })
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { abonnements, entreprises, chargement, erreur, recharger };
}

export interface ActionAbonnement {
  creerUnAbonnement: (donnees: AbonnementEnvoye) => Promise<boolean>;
  modifierUnAbonnement: (id: number, donnees: AbonnementModifie) => Promise<boolean>;
  archiverUnAbonnement: (id: number) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

export function useActionsAbonnement(surSucces: () => void): ActionAbonnement {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const executer = useCallback(
    async (appel: () => Promise<unknown>): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await appel();
        surSucces();
        return true;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [surSucces]
  );

  return {
    creerUnAbonnement: (donnees) => executer(() => creerAbonnement(donnees)),
    modifierUnAbonnement: (id, donnees) =>
      executer(() => modifierAbonnement(id, donnees)),
    archiverUnAbonnement: (id) => executer(() => archiverAbonnement(id)),
    envoi,
    erreur,
  };
}

// --- Détail ---------------------------------------------------------------

export interface AbonnementDetailAdministration {
  abonnement: Abonnement | null;
  solde: SoldeAbonnement | null;
  consommations: ConsommationRepas[];
  /**
   * `null` tant que non résolu ou en mode `Global` : la table du tableau de
   * suivi doit distinguer « pas encore chargé » de « aucun bénéficiaire ».
   */
  beneficiaires: Beneficiaire[] | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Orchestration à 3-4 appels pour la fiche abonnement.
 *
 * `abonnement`, `solde` et `consommations` sont toujours chargés ensemble —
 * aucune entité FACTURE n'existe, le solde n'est jamais renvoyé par
 * `GET /abonnements/administration/{id}` (cf. `docs/roadmap.md`, décision 7.2).
 *
 * `beneficiaires` n'est chargé **qu'en mode `Individuel`** : en `Global`, il
 * n'y a rien à résoudre, et l'appeler quand même téléchargerait une liste
 * dont le tableau n'a aucun usage.
 */
export function useAbonnementDetailAdministration(
  idAbonnement: number
): AbonnementDetailAdministration {
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [solde, setSolde] = useState<SoldeAbonnement | null>(null);
  const [consommations, setConsommations] = useState<ConsommationRepas[]>([]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    async function charger() {
      const donneesAbonnement = await recupererAbonnementAdministration(idAbonnement);
      if (!actif) return;

      const [donneesSolde, donneesConsommations, donneesBeneficiaires] =
        await Promise.all([
          recupererSoldeAdministration(idAbonnement),
          recupererConsommationsAdministration(idAbonnement),
          donneesAbonnement.mode_suivi === 'Individuel'
            ? recupererBeneficiairesAdministration(idAbonnement)
            : Promise.resolve(null),
        ]);
      if (!actif) return;

      setAbonnement(donneesAbonnement);
      setSolde(donneesSolde);
      setConsommations(donneesConsommations);
      setBeneficiaires(donneesBeneficiaires);
    }

    charger()
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [idAbonnement, jeton]);

  return {
    abonnement,
    solde,
    consommations,
    beneficiaires,
    chargement,
    erreur,
    recharger,
  };
}

/** Ajoute un bénéficiaire à un abonnement en mode `Individuel`, depuis la fiche. */
export function useAjouterBeneficiaire(surSucces: () => void) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const ajouter = useCallback(
    async (donnees: BeneficiaireEnvoye): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await creerBeneficiaireAdministration(donnees);
        surSucces();
        return true;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [surSucces]
  );

  return { ajouter, envoi, erreur };
}
