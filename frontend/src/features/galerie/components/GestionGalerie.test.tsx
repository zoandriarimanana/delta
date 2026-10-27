/** Tests de la gestion des photos, côté administration. */

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
    { fichier: '7-1.jpg' },
    { fichier: '7-2.png' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function fichierImage(): File {
  return new File(['octets'], 'salle.png', { type: 'image/png' });
}

it('liste les fichiers, nomme la couverture et le dossier de rangement', async () => {
  render(<GestionGalerie bien={{ salle: 7 }} />);

  expect(await screen.findByText(/7-1\.jpg/)).toBeDefined();
  expect(screen.getByText(/· couverture/)).toBeDefined();
  expect(screen.getByText('static/upload/salles/')).toBeDefined();
  expect(screen.getByText('2 / 10')).toBeDefined();
  expect(recupererPhotos).toHaveBeenCalledWith({ salle: 7 });
});

it('téléverse le fichier choisi, puis recharge', async () => {
  vi.mocked(ajouterPhoto).mockResolvedValue({ fichier: '4-1.png' });
  const { container } = render(<GestionGalerie bien={{ produit: 4 }} />);
  await screen.findByText(/7-1\.jpg/);

  const fichier = fichierImage();
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [fichier] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Ajouter la photo/ }));

  await waitFor(() =>
    expect(ajouterPhoto).toHaveBeenCalledWith({ produit: 4 }, fichier)
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
  await screen.findByText(/7-1\.jpg/);

  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [fichierImage()] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Ajouter la photo/ }));

  expect((await screen.findByRole('alert')).textContent).toContain('JPEG, PNG et WebP');
});

it('retire une photo par son nom de fichier', async () => {
  vi.mocked(supprimerPhoto).mockResolvedValue(undefined);
  render(<GestionGalerie bien={{ salle: 7 }} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Retirer la photo 2' }));

  await waitFor(() =>
    expect(supprimerPhoto).toHaveBeenCalledWith({ salle: 7 }, '7-2.png')
  );
});

it('n’offre plus d’ajout quand la galerie est complète', async () => {
  vi.mocked(recupererPhotos).mockResolvedValue(
    Array.from({ length: 10 }, (_, rang) => ({ fichier: `7-${rang + 1}.jpg` }))
  );
  render(<GestionGalerie bien={{ salle: 7 }} />);

  expect(await screen.findByText(/La galerie est complète/)).toBeDefined();
  expect(screen.queryByRole('button', { name: /Ajouter la photo/ })).toBeNull();
});
