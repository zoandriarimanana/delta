/**
 * Tests de la note moyenne.
 *
 * Même point central que `Badge.test.tsx` : la primitive ne doit connaître
 * aucune entité du MLD.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import NoteMoyenne from './NoteMoyenne';
import sourceNoteMoyenne from './NoteMoyenne.tsx?raw';

afterEach(cleanup);

describe('rendu', () => {
  it('affiche « pas encore noté » quand la moyenne est nulle', () => {
    render(<NoteMoyenne moyenne={null} nombre={0} />);

    expect(screen.getByText('Pas encore noté')).toBeDefined();
  });

  it('affiche la moyenne et le nombre d’avis', () => {
    render(<NoteMoyenne moyenne="4.0000000000000000" nombre={12} />);

    expect(screen.getByText('4.0 sur 5 · 12 avis')).toBeDefined();
  });

  it('ne confond jamais une moyenne nulle avec une moyenne à zéro', () => {
    const { container: sansAvis } = render(<NoteMoyenne moyenne={null} nombre={0} />);
    expect(sansAvis.textContent).not.toContain('0.0');
  });
});

describe('conception', () => {
  it('ne connaît aucune entité du MLD', () => {
    const source = sourceNoteMoyenne
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    for (const terme of [
      'Produit',
      'Salle',
      'Logement',
      'Formation',
      'id_produit',
      'id_salle',
      'id_logement',
      'id_formation',
    ]) {
      expect(source).not.toContain(terme);
    }
  });
});
