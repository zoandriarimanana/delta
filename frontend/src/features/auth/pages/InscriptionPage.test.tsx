/**
 * Tests de l'inscription client.
 *
 * Deux garanties portent l'essentiel.
 *
 * **Aucune session n'est ouverte par l'inscription**, et aucun appel n'est
 * fait à la connexion : enchaîner créerait un second point d'émission de jeton,
 * implicite, alors que le serveur n'en expose qu'un. Sans test, l'enchaînement
 * pourrait revenir sans que rien ne le signale.
 *
 * **Les deux variantes envoient la bonne charge utile**, avec l'identité en
 * objet **imbriqué** : envoyer les champs à plat donne un 422
 * `missing … body.identite`, constaté contre l'API.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession, lireSession } from '@/lib/tokenStorage';

import { connecterClient, inscrireEntreprise, inscrireParticulier } from '../auth.api';
import InscriptionPage from './InscriptionPage';

vi.mock('../auth.api');

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/inscription']}>
      <Routes>
        <Route path="/inscription" element={<InscriptionPage />} />
        <Route path="/connexion" element={<p>page de connexion</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function remplirCompte() {
  await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'jean@example.mg');
  await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123');
}

async function soumettre() {
  await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }));
}

const CREE = { id_client: 1, type_client: 'Particulier' as const, email: 'x@y.mg' };

beforeEach(() => {
  effacerJeton();
  vi.mocked(inscrireParticulier).mockResolvedValue(CREE);
  vi.mocked(inscrireEntreprise).mockResolvedValue({
    ...CREE,
    type_client: 'Entreprise',
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('particulier', () => {
  it('envoie l’identité en objet imbriqué', async () => {
    afficher();
    await remplirCompte();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Rakoto');
    await userEvent.type(screen.getByLabelText(/prénom/i), 'Jean');

    await soumettre();

    await waitFor(() =>
      expect(inscrireParticulier).toHaveBeenCalledWith({
        email: 'jean@example.mg',
        mot_de_passe: 'motdepasse123',
        identite: { nom: 'Rakoto', prenom: 'Jean' },
      })
    );
  });

  it('omet les champs facultatifs laissés vides', async () => {
    // Une chaîne vide n'est ni un téléphone ni une date : les envoyer donnerait
    // un 422 sur `date_naissance`.
    afficher();
    await remplirCompte();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Rakoto');
    await userEvent.type(screen.getByLabelText(/prénom/i), 'Jean');

    await soumettre();

    await waitFor(() => expect(inscrireParticulier).toHaveBeenCalled());
    const envoye = vi.mocked(inscrireParticulier).mock.calls[0]?.[0];
    expect(envoye).not.toHaveProperty('telephone');
    expect(envoye?.identite).not.toHaveProperty('date_naissance');
  });
});

describe('entreprise', () => {
  it('appelle l’endpoint entreprise avec sa propre identité', async () => {
    afficher();
    await userEvent.click(screen.getByLabelText(/entreprise/i));
    await remplirCompte();
    await userEvent.type(screen.getByLabelText(/raison sociale/i), 'Delta SARL');
    await userEvent.type(screen.getByLabelText(/identification fiscale/i), 'NIF-42');

    await soumettre();

    await waitFor(() =>
      expect(inscrireEntreprise).toHaveBeenCalledWith({
        email: 'jean@example.mg',
        mot_de_passe: 'motdepasse123',
        identite: { raison_sociale: 'Delta SARL', numero_id_fiscal: 'NIF-42' },
      })
    );
    expect(inscrireParticulier).not.toHaveBeenCalled();
  });
});

describe('après une inscription réussie', () => {
  async function inscrire() {
    afficher();
    await remplirCompte();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Rakoto');
    await userEvent.type(screen.getByLabelText(/prénom/i), 'Jean');
    await soumettre();
  }

  it('redirige vers l’écran de connexion', async () => {
    await inscrire();

    expect(await screen.findByText('page de connexion')).toBeDefined();
  });

  it('n’ouvre aucune session et n’appelle pas la connexion', async () => {
    // **Le point central.** L'API ne renvoie pas de jeton, et le frontend ne
    // doit pas en obtenir un dans la foulée : un seul chemin d'émission à
    // raisonner. Sans ce test, l'enchaînement automatique pourrait revenir.
    await inscrire();

    await screen.findByText('page de connexion');
    expect(lireSession()).toBeNull();
    expect(connecterClient).not.toHaveBeenCalled();
  });

  it('ne touche pas à une session déjà ouverte', async () => {
    // S'inscrire n'est pas se connecter : rien ne justifie de déconnecter
    // quelqu'un parce qu'il crée un second compte.
    enregistrerSession('jeton.client', 'client');

    await inscrire();

    await screen.findByText('page de connexion');
    expect(lireSession()).toEqual({ jeton: 'jeton.client', type: 'client' });
  });
});

describe('refus', () => {
  async function refuser(detail: unknown) {
    vi.mocked(inscrireParticulier).mockRejectedValue({
      response: { status: 409, data: { detail } },
    });
    afficher();
    await remplirCompte();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Rakoto');
    await userEvent.type(screen.getByLabelText(/prénom/i), 'Jean');
    await soumettre();
  }

  it('reprend le message du 409 tel quel', async () => {
    // Contrairement à la connexion, il n'y a rien à protéger : dire qu'une
    // adresse est prise est la raison même du refus.
    await refuser('Cette adresse e-mail est déjà utilisée.');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cette adresse e-mail est déjà utilisée.'
    );
  });

  it('ne redirige pas et n’ouvre aucune session', async () => {
    await refuser('Cette adresse e-mail est déjà utilisée.');

    await screen.findByRole('alert');
    expect(screen.queryByText('page de connexion')).toBeNull();
    expect(lireSession()).toBeNull();
  });

  it('ne laisse pas fuir une trace technique', async () => {
    await refuser([{ loc: ['body', 'identite'], msg: 'Field required' }]);

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('loc');
    expect(alerte.textContent).toMatch(/réessayez/i);
  });

  it('laisse réessayer', async () => {
    await refuser('Cette adresse e-mail est déjà utilisée.');

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeDefined();
  });
});
