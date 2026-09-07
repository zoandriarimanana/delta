/**
 * Tests du formulaire de paiement.
 *
 * Trois points portent l'essentiel :
 *
 * - un visiteur non connecté n'affiche rien plutôt que d'émettre un appel qui
 *   reviendrait en 401 (même garde que `FormulaireAvis`) ;
 * - les refus 409 sont repris tels quels — « cette commande est annulée » ou
 *   « cette commande a déjà été payée » disent au client quoi corriger ;
 * - `onConfirme` n'est appelé qu'une fois le paiement passé à `Reussi`, via
 *   `simuler()`, jamais à l'initiation (`En_attente`).
 */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import { initierPaiement, simulerConfirmation } from '../paiement.api';
import type { Paiement } from '../paiement.types';
import FormulairePaiement from './FormulairePaiement';

vi.mock('../paiement.api');

const PAIEMENT_EN_ATTENTE: Paiement = {
  id_paiement: 1,
  montant: '5000.00',
  methode: 'Mobile_money',
  fournisseur: 'Mvola',
  statut: 'En_attente',
  reference_externe: 'SIM-abc',
  date_paiement: '2026-09-07T10:00:00Z',
  id_commande: 42,
};

function erreurApi(status: number, detail: string) {
  return { response: { status, data: { detail } } };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('visiteur non connecté', () => {
  it("n'affiche rien et n'émet aucun appel", () => {
    const { container } = render(<FormulairePaiement idCommande={42} />);

    expect(container.firstChild).toBeNull();
    expect(initierPaiement).not.toHaveBeenCalled();
  });
});

describe('client connecté', () => {
  beforeEach(() => enregistrerSession('jeton.de.test', 'client'));

  it('initie le paiement pour la commande passée en propriété, sans montant', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(PAIEMENT_EN_ATTENTE);
    render(<FormulairePaiement idCommande={42} />);

    await userEvent.click(
      screen.getByRole('button', { name: /payer cette commande/i })
    );

    expect(initierPaiement).toHaveBeenCalledWith(42, {
      methode: 'Mobile_money',
      fournisseur: 'Mvola',
    });
  });

  it('affiche le statut En_attente après initiation, sans appeler onConfirme', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(PAIEMENT_EN_ATTENTE);
    const onConfirme = vi.fn();
    render(<FormulairePaiement idCommande={42} onConfirme={onConfirme} />);

    await userEvent.click(
      screen.getByRole('button', { name: /payer cette commande/i })
    );

    expect(await screen.findByText(/en attente de confirmation/i)).toBeTruthy();
    expect(onConfirme).not.toHaveBeenCalled();
  });

  it('reprend le message 409 tel quel — commande annulée', async () => {
    vi.mocked(initierPaiement).mockRejectedValue(
      erreurApi(
        409,
        "Cette commande est annulée : impossible d'y associer un paiement."
      )
    );
    render(<FormulairePaiement idCommande={42} />);

    await userEvent.click(
      screen.getByRole('button', { name: /payer cette commande/i })
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Cette commande est annulée'
    );
  });

  it('reprend le message 409 tel quel — commande déjà payée', async () => {
    vi.mocked(initierPaiement).mockRejectedValue(
      erreurApi(409, 'Cette commande a déjà été payée.')
    );
    render(<FormulairePaiement idCommande={42} />);

    await userEvent.click(
      screen.getByRole('button', { name: /payer cette commande/i })
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Cette commande a déjà été payée.'
    );
  });

  it('appelle onConfirme une fois, seulement quand simuler() renvoie Reussi', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(PAIEMENT_EN_ATTENTE);
    vi.mocked(simulerConfirmation).mockResolvedValue({
      ...PAIEMENT_EN_ATTENTE,
      statut: 'Reussi',
    });
    const onConfirme = vi.fn();
    render(<FormulairePaiement idCommande={42} onConfirme={onConfirme} />);

    await userEvent.click(
      screen.getByRole('button', { name: /payer cette commande/i })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /simuler la confirmation/i })
    );

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(onConfirme).toHaveBeenCalledTimes(1);
  });

  it('ne propose plus de simuler une fois le paiement Reussi', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(PAIEMENT_EN_ATTENTE);
    vi.mocked(simulerConfirmation).mockResolvedValue({
      ...PAIEMENT_EN_ATTENTE,
      statut: 'Reussi',
    });
    render(<FormulairePaiement idCommande={42} />);

    await userEvent.click(
      screen.getByRole('button', { name: /payer cette commande/i })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /simuler la confirmation/i })
    );

    await screen.findByRole('status');
    expect(
      screen.queryByRole('button', { name: /simuler la confirmation/i })
    ).toBeNull();
  });
});
