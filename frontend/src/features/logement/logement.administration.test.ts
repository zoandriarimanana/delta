/**
 * Tests des règles d'administration des logements.
 *
 * Le traitement des refus porte l'essentiel : ces messages disent quoi
 * corriger, et le **403** est le cas propre à ces écrans —
 * `est_administrateur` n'étant lisible nulle part côté client, un salarié
 * sans droit voit l'écran et se voit refuser l'écriture. Même patron que
 * `salle.administration.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { estArchive, messageDAdministration } from './logement.administration';

function refus(status: number, detail?: unknown) {
  return { response: { status, data: detail === undefined ? {} : { detail } } };
}

describe('messageDAdministration', () => {
  it('explique le 403 plutôt que de le rendre brut', () => {
    const message = messageDAdministration(refus(403));

    expect(message).toMatch(/administrateur/i);
    expect(message).not.toMatch(/réessayez/i);
  });

  it('reprend tel quel le refus d’archivage d’un logement encore réservé', () => {
    const message = messageDAdministration(
      refus(409, 'Ce logement porte encore des réservations actives.')
    );

    expect(message).toBe('Ce logement porte encore des réservations actives.');
  });

  it('ne laisse pas fuir une trace technique', () => {
    // Une erreur de validation de schema met une **liste** dans `detail` : la
    // rendre telle quelle afficherait du JSON.
    const message = messageDAdministration(
      refus(422, [{ loc: ['body', 'capacite'], msg: 'x' }])
    );

    expect(message).not.toContain('loc');
    expect(message).toMatch(/réessayez/i);
  });

  it('retombe sur un générique sans réponse exploitable', () => {
    expect(messageDAdministration(new Error('réseau'))).toMatch(/réessayez/i);
  });

  it('donne la priorité au 403 sur le contenu du corps', () => {
    const message = messageDAdministration(refus(403, 'Forbidden'));

    expect(message).toMatch(/administrateur/i);
  });
});

describe('estArchive', () => {
  it('distingue les deux états par supprime_le', () => {
    expect(estArchive({ supprime_le: null })).toBe(false);
    expect(estArchive({ supprime_le: '2026-09-03T08:12:44Z' })).toBe(true);
  });
});
