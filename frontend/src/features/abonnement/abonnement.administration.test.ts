/**
 * Tests des hooks d'administration du module abonnement.
 *
 * Le module d'API est substitué : ce qui est vérifié ici, c'est
 * l'orchestration des appels (3 ou 4 selon `mode_suivi`), pas le transport
 * HTTP — celui-ci est couvert par `lib/axiosClient.test.ts`.
 */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recupererAbonnementAdministration,
  recupererBeneficiairesAdministration,
  recupererConsommationsAdministration,
  recupererSoldeAdministration,
} from './abonnement.api';
import {
  messageDAdministration,
  useAbonnementDetailAdministration,
} from './abonnement.administration';
import type {
  Abonnement,
  Beneficiaire,
  ConsommationRepas,
  SoldeAbonnement,
} from './abonnement.types';

vi.mock('./abonnement.api');

const ABONNEMENT_GLOBAL: Abonnement = {
  id_abonnement: 1,
  date_debut: '2026-01-01',
  date_fin: '2026-12-31',
  type_facturation: 'Consommation_reelle',
  mode_suivi: 'Global',
  nombre_repas_inclus: null,
  tarif_forfait: null,
  tarif_unitaire_repas: '2500.00',
  id_client_entreprise: 42,
};

const ABONNEMENT_INDIVIDUEL: Abonnement = {
  ...ABONNEMENT_GLOBAL,
  mode_suivi: 'Individuel',
};

const SOLDE: SoldeAbonnement = {
  id_abonnement: 1,
  type_facturation: 'Consommation_reelle',
  repas_consommes: 4,
  repas_inclus: null,
  repas_restants: null,
  montant_facture: '10000.00',
};

const CONSOMMATIONS: ConsommationRepas[] = [
  {
    id_consommation: 1,
    date_consommation: '2026-03-01',
    quantite: 4,
    id_abonnement: 1,
    id_beneficiaire: null,
  },
];

const BENEFICIAIRES: Beneficiaire[] = [
  {
    id_beneficiaire: 1,
    nom: 'Rakoto',
    prenom: 'Jean',
    identifiant_badge: 'B001',
    statut: 'Actif',
    id_abonnement: 1,
  },
];

beforeEach(() => {
  vi.mocked(recupererSoldeAdministration).mockResolvedValue(SOLDE);
  vi.mocked(recupererConsommationsAdministration).mockResolvedValue(CONSOMMATIONS);
  vi.mocked(recupererBeneficiairesAdministration).mockResolvedValue(BENEFICIAIRES);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useAbonnementDetailAdministration', () => {
  it('charge abonnement, solde et consommations, sans bénéficiaires en mode Global', async () => {
    vi.mocked(recupererAbonnementAdministration).mockResolvedValue(ABONNEMENT_GLOBAL);

    const { result } = renderHook(() => useAbonnementDetailAdministration(1));

    expect(result.current.chargement).toBe(true);

    await waitFor(() => expect(result.current.chargement).toBe(false));

    expect(result.current.abonnement).toEqual(ABONNEMENT_GLOBAL);
    expect(result.current.solde).toEqual(SOLDE);
    expect(result.current.consommations).toEqual(CONSOMMATIONS);
    expect(result.current.beneficiaires).toBeNull();
    expect(recupererBeneficiairesAdministration).not.toHaveBeenCalled();
  });

  it('charge aussi les bénéficiaires en mode Individuel', async () => {
    vi.mocked(recupererAbonnementAdministration).mockResolvedValue(
      ABONNEMENT_INDIVIDUEL
    );

    const { result } = renderHook(() => useAbonnementDetailAdministration(1));

    await waitFor(() => expect(result.current.chargement).toBe(false));

    expect(result.current.beneficiaires).toEqual(BENEFICIAIRES);
    expect(recupererBeneficiairesAdministration).toHaveBeenCalledWith(1);
  });

  it('remonte le message de l’API en cas d’échec', async () => {
    vi.mocked(recupererAbonnementAdministration).mockRejectedValue({
      response: { status: 404, data: { detail: 'Abonnement introuvable.' } },
    });

    const { result } = renderHook(() => useAbonnementDetailAdministration(999));

    await waitFor(() => expect(result.current.chargement).toBe(false));

    expect(result.current.erreur).toBe('Abonnement introuvable.');
    expect(result.current.abonnement).toBeNull();
  });
});

describe('messageDAdministration', () => {
  it('retombe sur un message dédié pour un refus 403', () => {
    const erreur = { response: { status: 403 } };

    expect(messageDAdministration(erreur)).toBe(
      'Cette action est réservée aux administrateurs.'
    );
  });

  it('reprend le detail du serveur quand il est une chaîne', () => {
    const erreur = {
      response: { status: 409, data: { detail: 'Cet abonnement couvre encore…' } },
    };

    expect(messageDAdministration(erreur)).toBe('Cet abonnement couvre encore…');
  });

  it('retombe sur un message générique sans detail exploitable', () => {
    expect(messageDAdministration(new Error('boom'))).toBe(
      'L’opération a échoué. Réessayez dans un instant.'
    );
  });
});
