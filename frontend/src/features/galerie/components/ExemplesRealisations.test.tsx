/** Tests des exemples de réalisations d'une catégorie (consultation et choix). */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererPhotos } from '../galerie.api';
import ExemplesRealisations from './ExemplesRealisations';

vi.mock('../galerie.api', async (original) => ({
  ...(await original<typeof import('../galerie.api')>()),
  recupererPhotos: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(recupererPhotos).mockResolvedValue([
    { fichier: '4-1.jpg' },
    { fichier: '4-2.png' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('lit les photos de la catégorie et n’affiche rien sans photo', async () => {
  vi.mocked(recupererPhotos).mockResolvedValue([]);
  const { container } = render(
    <ExemplesRealisations bien={{ categorie: 4 }} titre="Exemples" />
  );

  await vi.waitFor(() =>
    expect(recupererPhotos).toHaveBeenCalledWith({ categorie: 4 })
  );
  expect(container.innerHTML).toBe('');
});

it('agrandit un exemple en consultation', async () => {
  render(<ExemplesRealisations bien={{ categorie: 4 }} titre="Exemples" />);

  const premier = await screen.findByRole('img', { name: 'Exemple 1' });
  expect(premier.getAttribute('src')).toMatch(/\/photos\/categories\/4-1\.jpg$/);
  await userEvent.click(screen.getByRole('button', { name: /agrandir l’exemple 2/i }));
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('désigne puis retire le modèle voulu', async () => {
  const surChoix = vi.fn();
  const { rerender } = render(
    <ExemplesRealisations bien={{ categorie: 4 }} titre="Modèles" surChoix={surChoix} />
  );

  await userEvent.click(
    await screen.findByRole('button', { name: /je veux ce modèle \(exemple 2\)/i })
  );
  expect(surChoix).toHaveBeenLastCalledWith('4-2.png');

  rerender(
    <ExemplesRealisations
      bien={{ categorie: 4 }}
      titre="Modèles"
      choix="4-2.png"
      surChoix={surChoix}
    />
  );
  const retenu = screen.getByRole('button', { name: /exemple 2/i });
  expect(retenu.getAttribute('aria-pressed')).toBe('true');
  await userEvent.click(retenu);
  expect(surChoix).toHaveBeenLastCalledWith(undefined);
});
