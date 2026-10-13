import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it } from 'vitest';

import { definirSession, effacerSession } from '@/lib/session.store';

import PiedDePage from './PiedDePage';

afterEach(() => {
  cleanup();
  act(() => effacerSession());
});

function afficher() {
  return render(
    <MemoryRouter>
      <PiedDePage />
    </MemoryRouter>
  );
}

it('affiche les horaires réels et les moyens de paiement acceptés', () => {
  afficher();

  expect(screen.getByText('Du lundi au samedi, de 7 h à 19 h')).toBeDefined();
  expect(screen.getByText('Fermé le dimanche et les jours fériés')).toBeDefined();
  for (const nom of ['MVola', 'Orange Money', 'Airtel Money', 'Carte bancaire']) {
    expect(screen.getByText(nom)).toBeDefined();
  }
});

it('propose connexion et inscription à un visiteur', () => {
  afficher();
  const espace = screen.getByRole('navigation', { name: 'Votre espace' });

  expect(within(espace).getByRole('link', { name: 'Connexion' })).toBeDefined();
  expect(
    within(espace).getByRole('link', { name: 'Créer un compte' }).getAttribute('href')
  ).toBe('/inscription');
});

it('propose commandes et réservations à un client connecté', () => {
  act(() => definirSession('client'));
  afficher();
  const espace = screen.getByRole('navigation', { name: 'Votre espace' });

  expect(within(espace).getByRole('link', { name: 'Mes commandes' })).toBeDefined();
  expect(within(espace).queryByRole('link', { name: 'Connexion' })).toBeNull();
});
