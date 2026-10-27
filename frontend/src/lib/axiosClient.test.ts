/**
 * Tests des intercepteurs du client axios.
 *
 * L'adaptateur d'axios est remplacé par une fonction contrôlée : les
 * intercepteurs s'exécutent tout autour, ce qui permet de les exercer sans
 * serveur ni bibliothèque de mock HTTP supplémentaire.
 *
 * Depuis T0.10, l'identité ne transite plus par un en-tête `Authorization`
 * (le cookie de session, `httpOnly`, part tout seul sur chaque requête grâce
 * à `withCredentials`) : ce qui reste à la charge de ce module, c'est le
 * double-submit anti-CSRF (`X-CSRF-Token`, recopié du cookie `delta_csrf`,
 * lisible celui-là) et le traitement du 401.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EVENEMENT_NON_AUTHENTIFIE, axiosClient } from './axiosClient';
import { definirSession, effacerSession, lireSession } from './session.store';

const CSRF = 'csrf.de.test';

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

function poserCookieCsrf(valeur: string | null): void {
  if (valeur === null) {
    document.cookie = 'delta_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    return;
  }
  document.cookie = `delta_csrf=${valeur}; path=/`;
}

beforeEach(() => {
  effacerSession();
  poserCookieCsrf(null);
});

afterEach(() => {
  effacerSession();
  poserCookieCsrf(null);
  vi.restoreAllMocks();
});

describe('intercepteur de requête — double-submit CSRF', () => {
  it('pose X-CSRF-Token sur une requête mutante quand le cookie existe', async () => {
    poserCookieCsrf(CSRF);
    axiosClient.defaults.adapter = adaptateurQuiReussit;

    const reponse = await axiosClient.post('/commandes', {});

    expect(reponse.config.headers['X-CSRF-Token']).toBe(CSRF);
  });

  it("n'ajoute aucun en-tête sur une requête mutante sans cookie CSRF", async () => {
    axiosClient.defaults.adapter = adaptateurQuiReussit;

    const reponse = await axiosClient.post('/commandes', {});

    expect(reponse.config.headers['X-CSRF-Token']).toBeUndefined();
  });

  it("n'ajoute aucun en-tête sur une requête GET, même avec le cookie présent", async () => {
    // Le middleware serveur ne vérifie que les méthodes mutantes : l'envoyer
    // sur un GET serait sans effet, autant ne pas l'envoyer.
    poserCookieCsrf(CSRF);
    axiosClient.defaults.adapter = adaptateurQuiReussit;

    const reponse = await axiosClient.get('/salle');

    expect(reponse.config.headers['X-CSRF-Token']).toBeUndefined();
  });
});

describe('configuration', () => {
  it("utilise l'URL de base issue de VITE_API_URL", () => {
    expect(axiosClient.defaults.baseURL).toBe(import.meta.env.VITE_API_URL);
    expect(axiosClient.defaults.baseURL).toContain('/api/v1');
  });

  it('envoie les cookies sur les requêtes cross-port (withCredentials)', () => {
    // Frontend (5173) et backend (8000) sont deux origines distinctes : sans
    // withCredentials, le cookie de session ne partirait jamais.
    expect(axiosClient.defaults.withCredentials).toBe(true);
  });
});

describe('intercepteur de réponse — 401', () => {
  it('efface la session et émet l’événement sur un chemin protégé', async () => {
    definirSession('client');
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(lireSession().type).toBeNull();
    expect(ecouteur).toHaveBeenCalledOnce();
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('laisse la session intacte sur /auth/connexion', async () => {
    // Un 401 de connexion signifie « mot de passe faux » : déconnecter
    // l'utilisateur déjà authentifié serait un effet de bord injustifié.
    definirSession('client');
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.post('/auth/connexion', {})).rejects.toBeInstanceOf(
      AxiosError
    );

    expect(lireSession().type).toBe('client');
    expect(ecouteur).not.toHaveBeenCalled();
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('laisse la session intacte sur /auth/personnel/connexion', async () => {
    // Même raison que pour la connexion client : un salarié qui se trompe de
    // mot de passe ne doit pas perdre la session en cours. Sans cette entrée
    // dans les chemins publics, une faute de frappe se paierait d'une
    // déconnexion.
    definirSession('personnel');
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(
      axiosClient.post('/auth/personnel/connexion', {})
    ).rejects.toBeInstanceOf(AxiosError);

    expect(lireSession().type).toBe('personnel');
    expect(ecouteur).not.toHaveBeenCalled();
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('laisse la session intacte sur /auth/moi', async () => {
    // Un visiteur jamais connecté reçoit systématiquement 401 sur cet appel,
    // au chargement de chaque page : c'est le cas normal, pas une session qui
    // expire. Sans cette entrée, tout visiteur non connecté serait redirigé
    // vers /connexion dès l'arrivée sur le site.
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.get('/auth/moi')).rejects.toBeInstanceOf(AxiosError);

    expect(ecouteur).not.toHaveBeenCalled();
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('porte la population déconnectée dans l’événement', async () => {
    // La session est effacée avant l'émission : sans cette information,
    // l'écouteur renverrait un salarié vers la connexion client.
    definirSession('personnel');
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.get('/personnel')).rejects.toBeInstanceOf(AxiosError);

    expect(ecouteur.mock.calls[0]?.[0]?.detail).toEqual({ type: 'personnel' });
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('porte un type nul quand aucune session n’était ouverte', async () => {
    // Un 401 sur une requête anonyme : il n'y a personne à renvoyer quelque
    // part de particulier.
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(ecouteur.mock.calls[0]?.[0]?.detail).toEqual({ type: null });
    window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, ecouteur);
  });

  it('laisse la session intacte sur un statut autre que 401', async () => {
    definirSession('client');
    axiosClient.defaults.adapter = adaptateurQuiEchoue(500);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(lireSession().type).toBe('client');
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
    definirSession('client');
    axiosClient.defaults.adapter = adaptateurQuiEchoue(401);
    const recus: string[] = [];
    const ecouteur = (evenement: Event) => recus.push(evenement.type);
    window.addEventListener('delta:non-authentifie', ecouteur);

    await expect(axiosClient.get('/salle')).rejects.toBeInstanceOf(AxiosError);

    expect(recus).toEqual(['delta:non-authentifie']);
    window.removeEventListener('delta:non-authentifie', ecouteur);
  });
});
