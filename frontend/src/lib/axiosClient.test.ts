/**
 * Tests des intercepteurs du client axios.
 *
 * L'adaptateur d'axios est remplacé par une fonction contrôlée : les
 * intercepteurs s'exécutent tout autour, ce qui permet de les exercer sans
 * serveur ni bibliothèque de mock HTTP supplémentaire.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EVENEMENT_NON_AUTHENTIFIE, axiosClient } from './axiosClient';
import { effacerJeton, enregistrerJeton, lireJeton } from './tokenStorage';

const JETON = 'jeton.de.test';

/** Adaptateur qui réussit et renvoie la configuration vue par la requête. */
const adaptateurQuiReussit: AxiosAdapter = async (config) =>
  ({
    data: { ok: true },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }) as AxiosResponse;

/** Adaptateur qui échoue avec le statut demandé. */
function adaptateurQuiEchoue(statut: number): AxiosAdapter {
  return async (config) => {
    throw new AxiosError('echec simule', String(statut), config, null, {
      data: { detail: 'refuse' },
      status: statut,
      statusText: 'Error',
      headers: {},
      config,
    } as AxiosResponse);
  };
}

beforeEach(() => {
  effacerJeton();
});

afterEach(() => {
  effacerJeton();
  vi.restoreAllMocks();
});

describe('intercepteur de requête', () => {
  it('injecte le jeton en en-tête Authorization quand il existe', async () => {
    enregistrerJeton(JETON);
    axiosClient.defaults.adapter = adaptateurQuiReussit;

    const reponse = await axiosClient.get('/salle');

    expect(reponse.config.headers.Authorization).toBe(`Bearer ${JETON}`);
  });

  it("n'ajoute aucun en-tête Authorization en l'absence de jeton", async () => {
    axiosClient.defaults.adapter = adaptateurQuiReussit;

    const reponse = await axiosClient.get('/salle');

    expect(reponse.config.headers.Authorization).toBeUndefined();
  });
});

describe('intercepteur de réponse — 401', () => {
  it('efface le jeton et émet l’événement sur un chemin protégé', async () => {
    enregistrerJeton(JETON);
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(lireJeton()).toBeNull();
    expect(ecouteur).toHaveBeenCalledOnce();
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('laisse le jeton intact sur /auth/connexion', async () => {
    // Un 401 de connexion signifie « mot de passe faux » : déconnecter
    // l'utilisateur déjà authentifié serait un effet de bord injustifié.
    enregistrerJeton(JETON);
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.post('/auth/connexion', {})).rejects.toBeInstanceOf(
      AxiosError
    );

    expect(lireJeton()).toBe(JETON);
    expect(ecouteur).not.toHaveBeenCalled();
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('laisse le jeton intact sur un statut autre que 401', async () => {
    enregistrerJeton(JETON);
    axiosClient.defaults.adapter = adaptateurQuiEchoue(500);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(lireJeton()).toBe(JETON);
  });

  it("propage l'erreur au lieu de l'absorber", async () => {
    axiosClient.defaults.adapter = adaptateurQuiEchoue(409);

    // Le module appelant doit pouvoir afficher son propre message métier :
    // l'intercepteur nettoie, il ne décide pas à la place de l'appelant.
    await expect(axiosClient.post('/auth/inscription', {})).rejects.toMatchObject({
      response: { status: 409 },
    });
  });
});

describe("nom de l'événement de déconnexion", () => {
  it("vaut exactement 'delta:non-authentifie'", () => {
    // Littéral volontairement dupliqué plutôt qu'importé : c'est le seul moyen
    // de détecter une faute de frappe dans la constante. Un test écrit avec
    // `EVENEMENT_NON_AUTHENTIFIE` des deux côtés resterait vert même si le nom
    // changeait, et l'écouteur du layout (T0.11) n'entendrait plus rien.
    expect(EVENEMENT_NON_AUTHENTIFIE).toBe('delta:non-authentifie');
  });

  it("est émis sous ce nom exact lors d'un 401", async () => {
    enregistrerJeton(JETON);
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const recus: string[] = [];
    const ecouteur = (evenement: Event) => recus.push(evenement.type);
    window.addEventListener('delta:non-authentifie', ecouteur);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(recus).toEqual(['delta:non-authentifie']);
    window.removeEventListener('delta:non-authentifie', ecouteur);
  });
});

describe('configuration', () => {
  it("utilise l'URL de base issue de VITE_API_URL", () => {
    expect(axiosClient.defaults.baseURL).toBe(import.meta.env.VITE_API_URL);
    expect(axiosClient.defaults.baseURL).toContain('/api/v1');
  });
});
