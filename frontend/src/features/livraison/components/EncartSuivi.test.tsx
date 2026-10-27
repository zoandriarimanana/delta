/**
 * Tests de l'encart autonome, tel que les deux pages l'utilisent.
 *
 * Ce qu'on vérifie ici et pas ailleurs : une commande **à retirer** n'affiche
 * rien du tout. C'est le cas courant — la plupart des commandes ne sont pas
 * livrées — et un bloc vide s'y lirait comme une anomalie.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recupererSuivi, recupererSuiviInvite } from '../livraison.api';
import type { SuiviLivraison } from '../livraison.types';
import { EncartSuiviCommande, EncartSuiviInvite } from './EncartSuivi';

vi.mock('../livraison.api');

const REFERENCE = '8f14e45f-ceea-467a-9f5a-1f0a1f0a1f0a';

const SUIVI: SuiviLivraison = {
  statut: 'En_cours',
  date_heure_prevue: null,
  date_heure_reelle: null,
};

beforeEach(() => {
  vi.mocked(recupererSuivi).mockResolvedValue(SUIVI);
  vi.mocked(recupererSuiviInvite).mockResolvedValue(SUIVI);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('commande connectée', () => {
  it('affiche le suivi', async () => {
    render(<EncartSuiviCommande idCommande={7} />);

    expect(await screen.findByLabelText('Suivi de livraison')).toBeDefined();
  });

  it('n’affiche rien pour une commande à retirer', async () => {
    // 404 côté serveur : la commande existe, elle n'a simplement pas de
    // livraison.
    vi.mocked(recupererSuivi).mockRejectedValue({ response: { status: 404 } });

    const { container } = render(<EncartSuiviCommande idCommande={7} />);

    await waitFor(() => expect(recupererSuivi).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('signale une panne sans casser la page', async () => {
    vi.mocked(recupererSuivi).mockRejectedValue({ response: { status: 500 } });

    render(<EncartSuiviCommande idCommande={7} />);

    expect(await screen.findByRole('alert')).toBeDefined();
  });
});

describe('commande invitée', () => {
  it('affiche le suivi sans jeton', async () => {
    render(<EncartSuiviInvite reference={REFERENCE} />);

    expect(await screen.findByLabelText('Suivi de livraison')).toBeDefined();
    expect(recupererSuiviInvite).toHaveBeenCalledWith(REFERENCE);
  });

  it('utilise le même rendu que la page connectée', async () => {
    // Une seconde implémentation divergerait tôt ou tard, et c'est justement
    // sur la page publique qu'une divulgation serait la plus grave.
    render(<EncartSuiviInvite reference={REFERENCE} />);

    const encart = await screen.findByLabelText('Suivi de livraison');
    expect(encart.textContent).toMatch(/en cours de livraison/i);
  });
});
