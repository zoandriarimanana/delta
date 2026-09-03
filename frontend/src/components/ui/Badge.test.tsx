/**
 * Tests de la pastille.
 *
 * Le point central est **négatif** : elle ne doit connaître aucune entité. La
 * version d'origine portait une table de statuts couvrant quatre entités à la
 * fois, alors que trois modules portaient déjà chacun son `libelleStatut`.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Badge from './Badge';
// `?raw` de Vite plutôt que `node:fs` : la source est lue par le même
// mécanisme que le reste des imports, sans dépendre des types Node.
import sourceBadge from './Badge.tsx?raw';

afterEach(cleanup);

describe('rendu', () => {
  it('affiche le libellé qu’on lui donne', () => {
    // Le libellé est **traduit par le module** : la pastille ne le fabrique
    // jamais.
    render(<Badge variante="positif">Disponible à la réservation</Badge>);

    expect(screen.getByText('Disponible à la réservation')).toBeDefined();
  });

  it('applique une apparence distincte par variante', () => {
    const { container: positif } = render(<Badge variante="positif">x</Badge>);
    const classesPositif = positif.firstElementChild?.className ?? '';
    cleanup();
    const { container: negatif } = render(<Badge variante="negatif">x</Badge>);

    expect(negatif.firstElementChild?.className).not.toBe(classesPositif);
  });

  it('retombe sur la variante neutre par défaut', () => {
    const { container } = render(<Badge>x</Badge>);

    expect(container.firstElementChild?.className).toContain('warm-gray');
  });
});

describe('conception', () => {
  it('ne connaît aucune entité du MLD', () => {
    // Test de conception : il tombe si quelqu'un remet une table de statuts
    // métier dans la primitive. `Badge` doit rester peignable sans savoir ce
    // qu'il peint.
    // Les commentaires sont retirés avant l'examen : la docstring **explique**
    // pourquoi la primitive ignore les statuts, et le mot y figure
    // légitimement. C'est le code qui ne doit pas les connaître.
    const source = sourceBadge.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

    for (const terme of [
      'Disponible',
      'En_maintenance',
      'Hors_service',
      'Confirmee',
      'Honoree',
      'Annulee',
      'Livree',
      'Echouee',
      'statut',
    ]) {
      expect(source).not.toContain(terme);
    }
  });
});
