/**
 * Écran d'administration de l'assistant IA.
 *
 * Garanties : l'état est lisible, même assistant coupé ; la réindexation
 * demande confirmation ; le 403 d'un salarié sans droit est rendu lisible.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lancerReindexation, recupererEtat } from '../assistant.api';
import AdministrationAssistantPage from './AdministrationAssistantPage';

vi.mock('../assistant.api');

const ETAT = {
  actif: true,
  llm_joignable: true,
  modele_llm: 'openai/gpt-oss-120b',
  modele_embeddings: 'BAAI/bge-m3',
  fragments_par_type: { produit: 12, salle: 3 },
  total_fragments: 15,
};

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationAssistantPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('AdministrationAssistantPage', () => {
  it('affiche l’état et le contenu de l’index', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);

    afficher();

    expect(await screen.findByText('Activé')).toBeTruthy();
    expect(screen.getByText('Joignable')).toBeTruthy();
    expect(screen.getByText('BAAI/bge-m3')).toBeTruthy();
    expect(screen.getByText(/15 fragment\(s\) indexé\(s\)/)).toBeTruthy();
    expect(screen.getByText('Produit')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Interroger l’assistant' })
    ).toBeTruthy();
  });

  it('assistant coupé : état lisible, réindexation et conversation indisponibles', async () => {
    vi.mocked(recupererEtat).mockResolvedValue({
      ...ETAT,
      actif: false,
      llm_joignable: false,
      fragments_par_type: {},
      total_fragments: 0,
    });

    afficher();

    expect(await screen.findByText('Désactivé')).toBeTruthy();
    const bouton = screen.getByRole('button', { name: 'Réindexer tout le catalogue' });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.queryByRole('heading', { name: 'Interroger l’assistant' })
    ).toBeNull();
  });

  it('réindexe après confirmation, puis rafraîchit l’état', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);
    vi.mocked(lancerReindexation).mockResolvedValue({
      par_type: { produit: { elements: 10, fragments: 12 } },
      total_fragments: 12,
    });
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Réindexer tout le catalogue' })
    );
    expect(lancerReindexation).not.toHaveBeenCalled();
    await utilisateur.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText(/Réindexation terminée : 12 fragment/)).toBeTruthy();
    await waitFor(() => expect(recupererEtat).toHaveBeenCalledTimes(2));
  });

  it('rend lisible le 403 d’un salarié sans droit', async () => {
    vi.mocked(recupererEtat).mockRejectedValue({
      response: { status: 403, data: { detail: 'Droits insuffisants.' } },
    });

    afficher();

    expect(
      await screen.findByText('Cette action est réservée aux administrateurs.')
    ).toBeTruthy();
  });
});
