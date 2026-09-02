/**
 * Tests de la connexion du personnel.
 *
 * Deux garanties portent l'essentiel : la session ouverte est de population
 * `personnel` — et non `client`, ce qui donnerait accès aux pages client tout en
 * recevant des 401 —, et un refus n'ouvre aucune session.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession, lireSession } from '@/lib/tokenStorage';

import { connecterPersonnel } from '../auth.api';
import ConnexionPersonnelPage from './ConnexionPersonnelPage';

vi.mock('../auth.api');

function afficher() {
  return render(
    <MemoryRouter>
      <ConnexionPersonnelPage />
    </MemoryRouter>
  );
}

async function soumettre(email = 'chef@delta.mg', motDePasse = 'motdepasse') {
  await userEvent.type(screen.getByLabelText(/adresse professionnelle/i), email);
  await userEvent.type(screen.getByLabelText(/mot de passe/i), motDePasse);
  await userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
}

beforeEach(() => {
  effacerJeton();
  vi.mocked(connecterPersonnel).mockResolvedValue({
    access_token: 'jeton.personnel',
    token_type: 'bearer',
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('connexion réussie', () => {
  it('ouvre une session de population personnel', async () => {
    // `client` donnerait accès aux pages client, qui répondraient 401 et
    // effaceraient la session de travail du salarié.
    afficher();

    await soumettre();

    await waitFor(() =>
      expect(lireSession()).toEqual({ jeton: 'jeton.personnel', type: 'personnel' })
    );
  });

  it('appelle l’endpoint personnel et non celui du client', async () => {
    // C'est l'endpoint qui détermine la population du jeton émis : se tromper
    // ici produirait un jeton client rangé sous une étiquette personnel.
    afficher();

    await soumettre('chef@delta.mg', 'secret');

    await waitFor(() =>
      expect(connecterPersonnel).toHaveBeenCalledWith({
        email: 'chef@delta.mg',
        mot_de_passe: 'secret',
      })
    );
  });
});

describe('refus', () => {
  it('n’ouvre aucune session', async () => {
    vi.mocked(connecterPersonnel).mockRejectedValue({
      response: { status: 401, data: { detail: 'Identifiants invalides.' } },
    });
    afficher();

    await soumettre();

    await screen.findByRole('alert');
    expect(lireSession()).toBeNull();
  });

  it('ferme la session existante plutôt que de la laisser en place', async () => {
    // Rester connecté comme client après avoir tenté d'ouvrir une session
    // personnel laisserait l'utilisateur sur un état qu'il n'a pas demandé.
    enregistrerSession('jeton.client', 'client');
    vi.mocked(connecterPersonnel).mockRejectedValue({
      response: { status: 401, data: { detail: 'Identifiants invalides.' } },
    });
    afficher();

    await soumettre();

    await screen.findByRole('alert');
    expect(lireSession()).toBeNull();
  });

  it('reprend le message uniforme du serveur', async () => {
    // Le serveur répond le **même** message à tout refus : le reprendre ne
    // divulgue donc rien sur l'existence du compte.
    vi.mocked(connecterPersonnel).mockRejectedValue({
      response: { status: 401, data: { detail: 'Identifiants invalides.' } },
    });
    afficher();

    await soumettre();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Identifiants invalides.'
    );
  });

  it('ne laisse pas fuir une trace technique', async () => {
    vi.mocked(connecterPersonnel).mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body'], msg: 'x' }] } },
    });
    afficher();

    await soumettre();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('loc');
    expect(alerte.textContent).toMatch(/réessayez/i);
  });

  it('laisse réessayer', async () => {
    vi.mocked(connecterPersonnel).mockRejectedValue({
      response: { status: 401, data: { detail: 'Identifiants invalides.' } },
    });
    afficher();

    await soumettre();
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDefined();
  });
});
