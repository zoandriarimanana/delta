/** Règles pures de l'assistant IA (Sprint 12). */

import { describe, expect, it } from 'vitest';

import {
  extraireEvenements,
  libelleSource,
  lienSource,
  messageErreur,
  segmentsGras,
} from './assistant.service';

describe('extraireEvenements', () => {
  it('interprète les événements complets et garde la fin incomplète', () => {
    const { evenements, reste } = extraireEvenements(
      'data: {"jeton": "Bon"}\n\ndata: {"jeton": "jour"}\n\ndata: {"fin": tr'
    );

    expect(evenements).toEqual([{ jeton: 'Bon' }, { jeton: 'jour' }]);
    expect(reste).toBe('data: {"fin": tr');
  });

  it('reconstitue un événement coupé entre deux morceaux réseau', () => {
    const premier = extraireEvenements('data: {"fin": tr');
    const second = extraireEvenements(`${premier.reste}ue, "sources": []}\n\n`);

    expect(premier.evenements).toEqual([]);
    expect(second.evenements).toEqual([{ fin: true, sources: [] }]);
  });

  it('ignore un événement illisible sans perdre les suivants', () => {
    const { evenements } = extraireEvenements(
      'data: {cassé\n\ndata: {"jeton": "ok"}\n\n'
    );
    expect(evenements).toEqual([{ jeton: 'ok' }]);
  });
});

describe('sources', () => {
  it('renvoie chaque type vers sa fiche', () => {
    expect(lienSource({ type_contenu: 'produit', id_contenu: 3, titre: null })).toBe(
      '/produits/3'
    );
    expect(lienSource({ type_contenu: 'formation', id_contenu: 7, titre: null })).toBe(
      '/formations/7'
    );
    expect(lienSource({ type_contenu: 'salle', id_contenu: 1, titre: null })).toBe(
      '/salles/1'
    );
    expect(lienSource({ type_contenu: 'logement', id_contenu: 2, titre: null })).toBe(
      '/logements/2'
    );
    expect(
      lienSource({ type_contenu: 'categorie_produit', id_contenu: 4, titre: null })
    ).toBe('/produits');
  });

  it('ne fabrique pas de lien pour un type inconnu', () => {
    expect(
      lienSource({ type_contenu: 'commande', id_contenu: 1, titre: null })
    ).toBeNull();
  });

  it('affiche le titre, ou le type à défaut', () => {
    expect(
      libelleSource({ type_contenu: 'produit', id_contenu: 3, titre: 'Tarte' })
    ).toBe('Tarte');
    expect(
      libelleSource({ type_contenu: 'logement', id_contenu: 2, titre: null })
    ).toBe('Hébergement');
  });
});

describe('messageErreur', () => {
  it('reprend le 503 du serveur tel quel', () => {
    expect(messageErreur(503, 'L’assistant est momentanément indisponible.')).toBe(
      'L’assistant est momentanément indisponible.'
    );
  });

  it('reformule le 429 et le 422 pour un visiteur', () => {
    expect(messageErreur(429, 'Rate limit exceeded: 10 per 1 minute')).toMatch(
      /Patientez une minute/
    );
    expect(messageErreur(422, [{ msg: 'x' }])).toMatch(/500 caractères/);
  });

  it('dit de se reconnecter sur un 401 plutôt qu’un message générique', () => {
    expect(messageErreur(401, 'Jeton d’accès absent ou invalide.')).toMatch(
      /reconnectez-vous/
    );
  });

  it('retombe sur un message générique sinon', () => {
    expect(messageErreur(500, 'Internal Server Error')).toMatch(/n’a pas pu répondre/);
  });
});

describe('segmentsGras', () => {
  it('interprète le gras du LLM', () => {
    expect(segmentsGras('La **Salle Ravinala** accueille 40 personnes.')).toEqual([
      { texte: 'La ', gras: false },
      { texte: 'Salle Ravinala', gras: true },
      { texte: ' accueille 40 personnes.', gras: false },
    ]);
  });

  it('laisse un marqueur non refermé en texte ordinaire (réponse en cours)', () => {
    expect(segmentsGras('La **Salle Rav')).toEqual([
      { texte: 'La **Salle Rav', gras: false },
    ]);
  });

  it('ne produit jamais de HTML : le texte reste du texte', () => {
    expect(segmentsGras('<img src=x onerror=alert(1)>')).toEqual([
      { texte: '<img src=x onerror=alert(1)>', gras: false },
    ]);
  });
});
