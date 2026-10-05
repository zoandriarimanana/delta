/** Tests de la galerie publique d'un bien. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import GaleriePhotos from './GaleriePhotos';

const PHOTOS = [
  { id_photo: 11, legende: 'Vue depuis l’entrée' },
  { id_photo: 12, legende: null },
  { id_photo: 13, legende: 'Coin lecture' },
];

afterEach(cleanup);

function afficher(photos = PHOTOS) {
  return render(
    <GaleriePhotos
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
  expect(screen.queryByText(/\/ /)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Agrandir la photo' })).toBeNull();
});

it('montre la première photo, sa légende et le compteur', () => {
  afficher();

  const principale = screen.getByRole('img', { name: 'Vue depuis l’entrée' });
  expect(principale.getAttribute('src')).toMatch(/\/photos-biens\/11$/);
  expect(screen.getByText('1 / 3')).toBeDefined();
});

it('passe d’une photo à l’autre, en boucle', () => {
  afficher();

  fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
  expect(screen.getByText('3 / 3')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
  expect(screen.getByText('1 / 3')).toBeDefined();
});

it('une photo sans légende reçoit un texte alternatif tiré du nom du bien', () => {
  afficher();

  fireEvent.click(screen.getByRole('button', { name: 'Afficher la photo 2' }));
  expect(screen.getByRole('img', { name: 'Salle A, photo 2' })).toBeDefined();
});

it('ouvre le plein écran et le referme avec Échap', () => {
  afficher();

  fireEvent.click(screen.getByRole('button', { name: 'Agrandir la photo' }));
  expect(screen.getByRole('dialog', { name: 'Photos de Salle A' })).toBeDefined();

  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(
    screen.getAllByRole('img', { name: 'Salle A, photo 2' }).length
  ).toBeGreaterThan(0);

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('une photo unique n’affiche ni flèches ni miniatures', () => {
  afficher([PHOTOS[0]!]);

  expect(screen.queryByRole('button', { name: 'Photo suivante' })).toBeNull();
  expect(screen.queryByRole('list', { name: 'Miniatures' })).toBeNull();
});
