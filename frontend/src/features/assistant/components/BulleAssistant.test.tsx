/**
 * Bulle de l'assistant sur le site public.
 *
 * Garanties : invisible tant que l'assistant n'est pas activé ; réponse
 * affichée au fil des jetons ; sources transformées en liens vers les
 * fiches ; refus du serveur rendu lisible.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { poserQuestionEnFlux, recupererDisponibilite } from '../assistant.api';
import { ErreurAssistant } from '../assistant.service';
import type { EvenementFlux } from '../assistant.types';
import BulleAssistant from './BulleAssistant';

vi.mock('../assistant.api');

function afficher() {
  return render(
    <MemoryRouter>
      <BulleAssistant />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('BulleAssistant', () => {
  it('ne s’affiche pas si l’assistant est désactivé', async () => {
    vi.mocked(recupererDisponibilite).mockResolvedValue({ actif: false });

    afficher();

    await waitFor(() => expect(recupererDisponibilite).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull();
  });

  it('ne s’affiche pas si la disponibilité ne peut pas être lue', async () => {
    vi.mocked(recupererDisponibilite).mockRejectedValue(new Error('réseau'));

    afficher();

    await waitFor(() => expect(recupererDisponibilite).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull();
  });

  it('affiche la réponse en flux et ses sources en liens', async () => {
    vi.mocked(recupererDisponibilite).mockResolvedValue({ actif: true });
    vi.mocked(poserQuestionEnFlux).mockImplementation(
      async (_question, surEvenement) => {
        const evenements: EvenementFlux[] = [
          { jeton: 'Oui, la ' },
          { jeton: '**Salle Ravinala**' },
          { jeton: ' accueille 40 personnes.' },
          {
            fin: true,
            sources: [
              { type_contenu: 'salle', id_contenu: 1, titre: 'Salle Ravinala' },
            ],
          },
        ];
        evenements.forEach(surEvenement);
      }
    );
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Ouvrir l’assistant' })
    );
    await utilisateur.type(
      screen.getByLabelText('Votre question'),
      'Une salle pour 30 personnes ?{Enter}'
    );

    expect(
      await screen.findByText('Salle Ravinala', { selector: 'strong' })
    ).toBeTruthy();
    expect(screen.getByText('Une salle pour 30 personnes ?')).toBeTruthy();
    const lien = screen.getByRole('link', { name: 'Salle Ravinala' });
    expect(lien.getAttribute('href')).toBe('/salles/1');
    expect(poserQuestionEnFlux).toHaveBeenCalledWith(
      'Une salle pour 30 personnes ?',
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it('rend lisible un refus du serveur', async () => {
    vi.mocked(recupererDisponibilite).mockResolvedValue({ actif: true });
    vi.mocked(poserQuestionEnFlux).mockRejectedValue(
      new ErreurAssistant(503, 'L’assistant est momentanément indisponible.')
    );
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Ouvrir l’assistant' })
    );
    await utilisateur.click(
      screen.getByRole('button', { name: 'Faites-vous des gâteaux personnalisés ?' })
    );

    expect(
      await screen.findByText('L’assistant est momentanément indisponible.')
    ).toBeTruthy();
  });

  it('refuse d’envoyer une question vide ou trop longue', async () => {
    vi.mocked(recupererDisponibilite).mockResolvedValue({ actif: true });
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Ouvrir l’assistant' })
    );
    const envoyer = screen.getByRole('button', { name: 'Envoyer la question' });
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);

    await utilisateur.click(screen.getByLabelText('Votre question'));
    await utilisateur.paste('x'.repeat(501));
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('501/500')).toBeTruthy();
    expect(poserQuestionEnFlux).not.toHaveBeenCalled();
  });

  it('se ferme avec Échap', async () => {
    vi.mocked(recupererDisponibilite).mockResolvedValue({ actif: true });
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Ouvrir l’assistant' })
    );
    expect(screen.getByRole('region', { name: 'Assistant Delta' })).toBeTruthy();

    await utilisateur.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Assistant Delta' })).toBeNull();
  });
});
