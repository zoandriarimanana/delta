/** Tests de la gestion de galerie, côté administration. */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ajouterPhoto, recupererPhotos, supprimerPhoto } from '../galerie.api';
import GestionGalerie from './GestionGalerie';

vi.mock('../galerie.api', async (original) => ({
  ...(await original<typeof import('../galerie.api')>()),
  recupererPhotos: vi.fn(),
  ajouterPhoto: vi.fn(),
  supprimerPhoto: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(recupererPhotos).mockResolvedValue([
    { id_photo: 1, legende: null },
    { id_photo: 2, legende: 'Terrasse' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function fichierImage(): File {
  return new File(['octets'], 'salle.png', { type: 'image/png' });
}

it('liste les photos du bien et nomme la couverture', async () => {
  render(<GestionGalerie bien={{ salle: 7 }} />);

  expect(await screen.findByText('Couverture')).toBeDefined();
  expect(screen.getByText('Terrasse')).toBeDefined();
  expect(screen.getByText('2 / 10')).toBeDefined();
  expect(recupererPhotos).toHaveBeenCalledWith({ salle: 7 });
});

it('téléverse le fichier choisi avec sa légende, puis recharge', async () => {
  vi.mocked(ajouterPhoto).mockResolvedValue({ id_photo: 3, legende: 'Scène' });
  const { container } = render(<GestionGalerie bien={{ logement: 4 }} />);
  await screen.findByText('Couverture');

  const fichier = fichierImage();
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [fichier] },
  });
  fireEvent.change(screen.getByLabelText(/Légende/), { target: { value: 'Scène' } });
  fireEvent.click(screen.getByRole('button', { name: /Ajouter la photo/ }));

  await waitFor(() =>
    expect(ajouterPhoto).toHaveBeenCalledWith({ logement: 4 }, fichier, 'Scène')
  );
  await waitFor(() => expect(recupererPhotos).toHaveBeenCalledTimes(2));
});

it('reprend tel quel le refus du serveur', async () => {
  vi.mocked(ajouterPhoto).mockRejectedValue({
    response: {
      status: 400,
      data: { detail: 'Seules les images JPEG, PNG et WebP sont acceptées.' },
    },
  });
  const { container } = render(<GestionGalerie bien={{ salle: 7 }} />);
  await screen.findByText('Couverture');

  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [fichierImage()] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Ajouter la photo/ }));

  expect((await screen.findByRole('alert')).textContent).toContain('JPEG, PNG et WebP');
});

it('retire une photo', async () => {
  vi.mocked(supprimerPhoto).mockResolvedValue(undefined);
  render(<GestionGalerie bien={{ salle: 7 }} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Retirer la photo 2' }));

  await waitFor(() => expect(supprimerPhoto).toHaveBeenCalledWith(2));
});

it('n’offre plus d’ajout quand la galerie est complète', async () => {
  vi.mocked(recupererPhotos).mockResolvedValue(
    Array.from({ length: 10 }, (_, rang) => ({ id_photo: rang + 1, legende: null }))
  );
  render(<GestionGalerie bien={{ salle: 7 }} />);

  expect(await screen.findByText(/La galerie est complète/)).toBeDefined();
  expect(screen.queryByRole('button', { name: /Ajouter la photo/ })).toBeNull();
});
