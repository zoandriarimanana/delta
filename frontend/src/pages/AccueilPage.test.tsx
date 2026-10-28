/**
 * Tests de la page d'accueil : chaque carte mène à son module, et la carte
 * « Mon compte » suit la session.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it } from 'vitest';

import { definirSession, effacerSession } from '@/lib/session.store';

import AccueilPage from './AccueilPage';

function afficher() {
  return render(
    <MemoryRouter>
      <AccueilPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  effacerSession();
});

it('affiche le titre et une carte par module, chacune vers sa page', () => {
  afficher();

  expect(
    screen.getByRole('heading', { level: 1, name: 'Bienvenue chez Delta' })
  ).toBeDefined();
  const attendus: [RegExp, string][] = [
    [/^Produits/, '/produits'],
    [/^Formations/, '/formations'],
    [/^Salles/, '/salles'],
    [/^Hébergement/, '/logements'],
    [/^Panier/, '/panier'],
  ];
  for (const [nom, vers] of attendus) {
    expect(screen.getByRole('link', { name: nom }).getAttribute('href')).toBe(vers);
  }
});

it('envoie un visiteur vers la connexion depuis « Mon compte »', () => {
  afficher();

  expect(screen.getByRole('link', { name: /^Mon compte/ }).getAttribute('href')).toBe(
    '/connexion'
  );
});

it('envoie un client connecté vers ses commandes depuis « Mon compte »', () => {
  definirSession('client');

  afficher();

  expect(screen.getByRole('link', { name: /^Mon compte/ }).getAttribute('href')).toBe(
    '/commandes'
  );
});
