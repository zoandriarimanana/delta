/**
 * Tests du stockage de session.
 *
 * Le point central est qu'**une session sans type n'est pas une session**. Le
 * serveur refuse un jeton sans revendication `type` (#23) ; le stockage doit
 * refuser son équivalent local, sans quoi un enregistrement laissé par une
 * version antérieure serait lu comme une session client — exactement la
 * confusion d'identité que la revendication ferme.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  effacerJeton,
  enregistrerSession,
  lireJeton,
  lireSession,
} from './tokenStorage';

afterEach(() => {
  localStorage.clear();
});

describe('lireSession', () => {
  it('rend le jeton et sa population', () => {
    enregistrerSession('jeton.personnel', 'personnel');

    expect(lireSession()).toEqual({ jeton: 'jeton.personnel', type: 'personnel' });
  });

  it('rend null quand rien n’est enregistré', () => {
    expect(lireSession()).toBeNull();
  });

  it('rend null pour un jeton sans type', () => {
    // Ne peut venir que d'une version antérieure au cloisonnement. Le lire par
    // défaut comme un jeton client rouvrirait la confusion qu'on ferme ; le
    // coût est une reconnexion, ce qu'une expiration aurait imposé.
    localStorage.setItem('delta.access_token', 'jeton.orphelin');

    expect(lireSession()).toBeNull();
    expect(lireJeton()).toBeNull();
  });

  it('rend null pour un type inconnu', () => {
    // API en avance, ou stockage trafiqué : dans les deux cas on ne devine pas.
    localStorage.setItem('delta.access_token', 'jeton');
    localStorage.setItem('delta.token_type', 'administrateur');

    expect(lireSession()).toBeNull();
  });

  it('rend null pour un type sans jeton', () => {
    localStorage.setItem('delta.token_type', 'client');

    expect(lireSession()).toBeNull();
  });
});

describe('enregistrerSession', () => {
  it('remplace la session existante, y compris d’une autre population', () => {
    // Conséquence assumée du jeton unique typé : se connecter comme salarié
    // ferme la session cliente.
    enregistrerSession('jeton.client', 'client');
    enregistrerSession('jeton.personnel', 'personnel');

    expect(lireSession()).toEqual({ jeton: 'jeton.personnel', type: 'personnel' });
  });
});

describe('effacerJeton', () => {
  it('efface le type en même temps que le jeton', () => {
    // Laisser le type derrière produirait un état qui ne correspond à aucune
    // session réelle.
    enregistrerSession('jeton', 'personnel');

    effacerJeton();

    expect(lireSession()).toBeNull();
    expect(localStorage.getItem('delta.token_type')).toBeNull();
  });
});
