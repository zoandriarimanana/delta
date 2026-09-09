/**
 * Tests de l'avatar.
 *
 * Le point central, comme pour `Badge` : il ne doit connaître aucune entité
 * du MLD, seulement une URL et une taille. Le second point : le repli sur
 * l'icône générique n'est pas un cas d'erreur exceptionnel à simuler
 * artificiellement, c'est le comportement **normal** en l'absence de photo —
 * `<img onError>` est le seul moyen dont dispose ce composant pour le savoir,
 * `GET .../photo` répondant 404 sans jamais atteindre le navigateur avec un
 * contenu image.
 */

import { fireEvent, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Avatar from './Avatar';
// `?raw` de Vite, même mécanisme que `Badge.test.tsx`.
import sourceAvatar from './Avatar.tsx?raw';

afterEach(cleanup);

describe('rendu', () => {
  it('affiche une image tant que le chargement réussit', () => {
    render(<Avatar src="https://exemple.test/photo.png" alt="Photo de Jean" />);

    const image = screen.getByAltText('Photo de Jean');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://exemple.test/photo.png');
  });

  it('retombe sur une icône générique quand le chargement échoue', () => {
    render(<Avatar src="https://exemple.test/absente.png" alt="Photo de Jean" />);

    fireEvent.error(screen.getByAltText('Photo de Jean'));

    expect(screen.queryByRole('img', { name: 'Photo de Jean' })).not.toBeNull();
    // Ce n'est plus une balise <img> mais le repli — la vérifier par son rôle
    // ARIA explicite suffit, sans dépendre du balisage exact de l'icône.
    expect(screen.queryByAltText('Photo de Jean')).toBeNull();
  });

  it('applique une dimension différente selon la taille demandée', () => {
    const { container: petite } = render(
      <Avatar src="https://exemple.test/p.png" alt="" taille="petite" />
    );
    cleanup();
    const { container: grande } = render(
      <Avatar src="https://exemple.test/p.png" alt="" taille="grande" />
    );

    expect(grande.firstElementChild?.className).not.toBe(
      petite.firstElementChild?.className
    );
  });
});

describe('conception', () => {
  it('ne connaît aucune entité du MLD', () => {
    const source = sourceAvatar.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

    for (const terme of ['personnel', 'Personnel', 'PERSONNEL', 'photo_chemin']) {
      expect(source).not.toContain(terme);
    }
  });
});
