/**
 * Tests des règles d'administration des domaines de formation.
 *
 * Le traitement des refus porte l'essentiel : ces messages disent quoi
 * corriger, et le **403** est le cas propre à ces écrans —
 * `est_administrateur` n'étant lisible nulle part côté client, un salarié
 * sans droit voit l'écran et se voit refuser l'écriture. Même patron que
 * `produit.administration.test.ts`/`salle.administration.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { estArchive, messageDAdministration } from './formation.administration';

function refus(status: number, detail?: unknown) {
  return { response: { status, data: detail === undefined ? {} : { detail } } };
}

describe('messageDAdministration', () => {
  it('explique le 403 plutôt que de le rendre brut', () => {
    const message = messageDAdministration(refus(403));

    expect(message).toMatch(/administrateur/i);
    expect(message).not.toMatch(/réessayez/i);
  });

  it('reprend tel quel le refus d’archivage d’un domaine encore peuplé', () => {
    const message = messageDAdministration(
      refus(409, 'Ce domaine contient encore des formations.')
    );

    expect(message).toBe('Ce domaine contient encore des formations.');
  });

  it('reprend tel quel le refus de restauration sur collision', () => {
    const message = messageDAdministration(
      refus(409, 'Un domaine actif porte déjà ce libellé, restauration impossible.')
    );

    expect(message).toMatch(/restauration impossible/);
  });

  it('ne laisse pas fuir une trace technique', () => {
    const message = messageDAdministration(
      refus(422, [{ loc: ['body', 'libelle'], msg: 'x' }])
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
