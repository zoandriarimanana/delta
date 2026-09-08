/**
 * Tests de la connexion client.
 *
 * Trois garanties, les mêmes que pour la connexion personnel : la session
 * ouverte est de population `client`, un refus n'ouvre aucune session, et **un
 * refus ne touche pas à la session déjà en cours**.
 *
 * La troisième est la plus facile à casser : effacer par anticipation « pour
 * repartir propre » se défend en apparence, et déconnecte en pratique quelqu'un
 * qui n'a rien demandé. Elle avait dû être corrigée sur la connexion personnel
 * dans #63 ; les deux hooks partagent désormais une seule implémentation, mais
 * le test reste, parce que c'est le comportement qui est garanti, pas la
 * factorisation.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession, lireSession } from '@/lib/tokenStorage';

import { connecterClient, connecterPersonnel } from '../auth.api';
import ConnexionPage from './ConnexionPage';

vi.mock('../auth.api');

function afficher() {
  return render(
    <MemoryRouter>
      <ConnexionPage />
    </MemoryRouter>
  );
}

async function soumettre(email = 'jean@example.mg', motDePasse = 'motdepasse') {
  await userEvent.type(screen.getByLabelText(/adresse e-mail/i), email);
  await userEvent.type(screen.getByLabelText(/mot de passe/i), motDePasse);
  await userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
}

function refus() {
  vi.mocked(connecterClient).mockRejectedValue({
    response: { status: 401, data: { detail: 'E-mail ou mot de passe incorrect.' } },
  });
}

beforeEach(() => {
  effacerJeton();
  vi.mocked(connecterClient).mockResolvedValue({
    access_token: 'jeton.client',
    token_type: 'bearer',
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('connexion réussie', () => {
  it('ouvre une session de population client', async () => {
    afficher();

    await soumettre();

    await waitFor(() =>
      expect(lireSession()).toEqual({ jeton: 'jeton.client', type: 'client' })
    );
  });

  it('appelle l’endpoint client et non celui du personnel', async () => {
    // C'est l'endpoint qui détermine la population du jeton émis : se tromper
    // ici produirait un jeton personnel rangé sous une étiquette client.
    afficher();

    await soumettre('jean@example.mg', 'secret');

    await waitFor(() =>
      expect(connecterClient).toHaveBeenCalledWith({
        email: 'jean@example.mg',
        mot_de_passe: 'secret',
      })
    );
    expect(connecterPersonnel).not.toHaveBeenCalled();
  });
});

describe('refus', () => {
  it('n’ouvre aucune session', async () => {
    refus();
    afficher();

    await soumettre();

    await screen.findByRole('alert');
    expect(lireSession()).toBeNull();
  });

  it('laisse intacte une session personnel déjà valide', async () => {
    // La session n'est remplacée qu'au moment où une connexion réussit. Un
    // salarié qui tente une connexion client et se trompe ne perd pas sa
    // session de travail.
    enregistrerSession('jeton.personnel', 'personnel');
    refus();
    afficher();

    await soumettre();

    await screen.findByRole('alert');
    expect(lireSession()).toEqual({ jeton: 'jeton.personnel', type: 'personnel' });
  });

  it('laisse intacte une session client déjà valide', async () => {
    enregistrerSession('jeton.client.valide', 'client');
    refus();
    afficher();

    await soumettre();

    await screen.findByRole('alert');
    expect(lireSession()).toEqual({ jeton: 'jeton.client.valide', type: 'client' });
  });

  it('reprend le message uniforme du serveur', async () => {
    // Le serveur répond le **même** message à tout refus — adresse inconnue,
    // mot de passe faux, compte archivé : le reprendre ne révèle donc pas si le
    // compte existe.
    refus();
    afficher();

    await soumettre();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'E-mail ou mot de passe incorrect.'
    );
  });

  it('ne laisse pas fuir une trace technique', async () => {
    vi.mocked(connecterClient).mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body'], msg: 'x' }] } },
    });
    afficher();

    await soumettre();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('loc');
    expect(alerte.textContent).toMatch(/réessayez/i);
  });

  it('laisse réessayer', async () => {
    refus();
    afficher();

    await soumettre();
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDefined();
  });
});

describe('remplacement de session', () => {
  it('remplace une session personnel quand la connexion réussit', async () => {
    // Contrôle positif : sans lui, un hook qui n'écrirait jamais rien passerait
    // les trois tests de refus ci-dessus.
    enregistrerSession('jeton.personnel', 'personnel');
    afficher();

    await soumettre();

    await waitFor(() =>
      expect(lireSession()).toEqual({ jeton: 'jeton.client', type: 'client' })
    );
  });
});

describe('message de confirmation', () => {
  it('affiche le message porté par l’état de navigation', () => {
    // Vient de l'inscription, qui redirige ici plutôt que d'ouvrir une session.
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/connexion',
            state: { message: 'Compte créé, connectez-vous pour continuer.' },
          },
        ]}
      >
        <ConnexionPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status').textContent).toMatch(/compte créé/i);
  });

  it('n’affiche rien quand on arrive directement', () => {
    afficher();

    expect(screen.queryByRole('status')).toBeNull();
  });
});
