/**
 * Tests des règles d'administration du catalogue.
 *
 * Le traitement des refus porte l'essentiel : ces messages disent quoi
 * corriger, et le **403** est le cas propre à ces écrans — `est_administrateur`
 * n'étant lisible nulle part côté client, un salarié sans droit voit l'écran et
 * se voit refuser l'écriture.
 */

import { describe, expect, it } from 'vitest';

import { estArchive, messageDAdministration } from './produit.administration';

function refus(status: number, detail?: unknown) {
  return { response: { status, data: detail === undefined ? {} : { detail } } };
}

describe('messageDAdministration', () => {
  it('explique le 403 plutôt que de le rendre brut', () => {
    // Ni une panne, ni une session expirée : sa reconnexion n'y changerait
    // rien. Le message doit dire qu'il lui manque un droit.
    const message = messageDAdministration(refus(403));

    expect(message).toMatch(/administrateur/i);
    expect(message).not.toMatch(/réessayez/i);
  });

  it('reprend tel quel le refus d’archivage d’une catégorie peuplée', () => {
    const message = messageDAdministration(
      refus(409, 'Cette catégorie contient encore des produits.')
    );

    expect(message).toBe('Cette catégorie contient encore des produits.');
  });

  it('reprend tel quel le refus de restauration sur collision', () => {
    // Il dit exactement quoi faire : renommer l'autre, ou renoncer.
    const message = messageDAdministration(
      refus(409, 'Une catégorie active porte déjà ce libellé, restauration impossible.')
    );

    expect(message).toMatch(/restauration impossible/);
  });

  it('ne laisse pas fuir une trace technique', () => {
    // Une erreur de validation de schema met une **liste** dans `detail` : la
    // rendre telle quelle afficherait du JSON.
    const message = messageDAdministration(
      refus(422, [{ loc: ['body', 'prix_unitaire'], msg: 'x' }])
    );

    expect(message).not.toContain('loc');
    expect(message).toMatch(/réessayez/i);
  });

  it('retombe sur un générique sans réponse exploitable', () => {
    expect(messageDAdministration(new Error('réseau'))).toMatch(/réessayez/i);
  });

  it('donne la priorité au 403 sur le contenu du corps', () => {
    // Un 403 accompagné d'un detail générique doit rester lisible comme un
    // défaut de droit.
    const message = messageDAdministration(refus(403, 'Forbidden'));

    expect(message).toMatch(/administrateur/i);
  });
});

describe('estArchive', () => {
  it('distingue les deux états par supprime_le', () => {
    // C'est le seul discriminant : le champ n'existe que sur les schemas
    // d'administration, et c'est lui qui décide « archiver » ou « restaurer ».
    expect(estArchive({ supprime_le: null })).toBe(false);
    expect(estArchive({ supprime_le: '2026-09-03T08:12:44Z' })).toBe(true);
  });
});
