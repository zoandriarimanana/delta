/**
 * Tests de `LayoutPersonnel` — la sidebar de l'espace personnel.
 *
 * L'enjeu central, décidé pour le chantier sidebar : la section « Gestion »
 * doit être **absente**, pas grisée, pour un salarié qui ne porte pas
 * `est_administrateur`. Même patron que `MainLayout.test.tsx` pour la
 * déconnexion.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { definirSession, effacerSession, lireSession } from '@/lib/session.store';

import LayoutPersonnel from './LayoutPersonnel';

const { deconnecter } = vi.hoisted(() => ({ deconnecter: vi.fn() }));
vi.mock('@/features/auth/auth.api', () => ({ deconnecter }));

function afficher() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<LayoutPersonnel />}>
          <Route index element={<p>contenu</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerSession();
  deconnecter.mockReset();
});

afterEach(() => {
  cleanup();
  effacerSession();
});

it('affiche toujours « Prise de commande », quel que soit le droit', () => {
  definirSession('personnel', false);

  afficher();

  expect(screen.getByRole('link', { name: /prise de commande/i })).toBeDefined();
});

it('masque entièrement la section Gestion à un salarié sans droit', () => {
  // Absente, pas grisée : c'est la décision actée du chantier — un lien
  // qu'on ne peut pas utiliser ne doit même pas apparaître.
  definirSession('personnel', false);

  afficher();

  expect(screen.queryByText('Gestion')).toBeNull();
  for (const libelle of [
    'Personnel',
    'Réservations',
    'Commandes',
    'Abonnements',
    'Catalogue',
    'Catégories',
    'Salles',
    'Logements',
  ]) {
    expect(screen.queryByRole('link', { name: libelle })).toBeNull();
  }
});

it('affiche la section Gestion complète à un administrateur', () => {
  definirSession('personnel', true);

  afficher();

  expect(screen.getByText('Gestion')).toBeDefined();
  for (const libelle of [
    'Personnel',
    'Réservations',
    'Commandes',
    'Abonnements',
    'Catalogue',
    'Catégories',
    'Salles',
    'Logements',
  ]) {
    expect(screen.getByRole('link', { name: libelle })).toBeDefined();
  }
});

it('pointe le lien Salles vers /personnel/salles', () => {
  // Corrige de fait une régression de la tâche précédente (#143) : la route
  // existait, mais aucun lien n'y menait.
  definirSession('personnel', true);

  afficher();

  expect(screen.getByRole('link', { name: 'Salles' })).toHaveProperty(
    'href',
    expect.stringContaining('/personnel/salles')
  );
});

it('pointe le lien Logements vers /personnel/logements', () => {
  definirSession('personnel', true);

  afficher();

  expect(screen.getByRole('link', { name: 'Logements' })).toHaveProperty(
    'href',
    expect.stringContaining('/personnel/logements')
  );
});

it('se déconnecte depuis la sidebar', async () => {
  deconnecter.mockResolvedValue(undefined);
  definirSession('personnel', true);

  const utilisateur = userEvent.setup();
  afficher();
  await utilisateur.click(screen.getByRole('button', { name: /déconnexion/i }));

  await waitFor(() => expect(deconnecter).toHaveBeenCalledOnce());
  await waitFor(() => expect(lireSession().type).toBeNull());
});
