/** Tests de la galerie publique d'un élément du catalogue. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import GaleriePhotos from './GaleriePhotos';

const PHOTOS = [
  { fichier: '3-1.jpg' },
  { fichier: '3-2.png' },
  { fichier: '3-5.webp' },
];

afterEach(cleanup);

function afficher(photos = PHOTOS) {
  return render(
    <GaleriePhotos
      bien={{ salle: 3 }}
      photos={photos}
      repli="https://exemple.test/repli.jpg"
      nomBien="Salle A"
    />
  );
}

it('affiche l’illustration de repli, sans compteur, quand il n’y a aucune photo', () => {
  const { container } = afficher([]);

  expect(container.querySelector('img')?.getAttribute('src')).toBe(
    'https://exemple.test/repli.jpg'
  );
  expect(screen.queryByRole('button', { name: 'Agrandir la photo' })).toBeNull();
});

it('lit la photo dans le dossier de sa partie', () => {
  afficher();

  const principale = screen.getByRole('img', { name: 'Salle A, photo 1 sur 3' });
  expect(principale.getAttribute('src')).toMatch(/\/photos\/salles\/3-1\.jpg$/);
  expect(screen.getByText('1 / 3')).toBeDefined();
});

it('passe d’une photo à l’autre, en boucle', () => {
  afficher();

  fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
  expect(screen.getByText('3 / 3')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
  expect(screen.getByText('1 / 3')).toBeDefined();
});

it('une miniature affiche la photo choisie', () => {
  afficher();

  fireEvent.click(screen.getByRole('button', { name: 'Afficher la photo 2' }));
  expect(
    screen.getByRole('img', { name: 'Salle A, photo 2 sur 3' }).getAttribute('src')
  ).toMatch(/3-2\.png$/);
});

it('ouvre le plein écran et le referme avec Échap', () => {
  afficher();

  fireEvent.click(screen.getByRole('button', { name: 'Agrandir la photo' }));
  expect(screen.getByRole('dialog', { name: 'Photos de Salle A' })).toBeDefined();

  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(
    screen.getAllByRole('img', { name: 'Salle A, photo 2 sur 3' }).length
  ).toBeGreaterThan(0);

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('une photo unique n’affiche ni flèches ni miniatures', () => {
  afficher([PHOTOS[0]!]);

  expect(screen.queryByRole('button', { name: 'Photo suivante' })).toBeNull();
  expect(screen.queryByRole('list', { name: 'Miniatures' })).toBeNull();
});
