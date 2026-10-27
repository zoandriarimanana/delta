/** Ligne cliquable : la ligne mène à sa fiche, ses boutons gardent leur effet. */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useNavigationAuClic } from './useNavigationAuClic';

afterEach(cleanup);

function Liste({ surBouton }: { surBouton: () => void }) {
  const naviguerAuClic = useNavigationAuClic();
  return (
    <table>
      <tbody>
        <tr onClick={naviguerAuClic('/fiche/7')}>
          <td>Tarte au citron</td>
          <td>
            <button type="button" onClick={surBouton}>
              Archiver
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function afficher(surBouton = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/liste']}>
      <Routes>
        <Route path="/liste" element={<Liste surBouton={surBouton} />} />
        <Route path="/fiche/:id" element={<p>Fiche ouverte</p>} />
      </Routes>
    </MemoryRouter>
  );
  return surBouton;
}

describe('useNavigationAuClic', () => {
  it('un clic sur la ligne ouvre la fiche', async () => {
    afficher();

    await userEvent.click(screen.getByText('Tarte au citron'));

    expect(screen.getByText('Fiche ouverte')).toBeTruthy();
  });

  it('un clic sur un bouton de la ligne garde son effet, sans naviguer', async () => {
    const surBouton = afficher();

    await userEvent.click(screen.getByRole('button', { name: 'Archiver' }));

    expect(surBouton).toHaveBeenCalledOnce();
    expect(screen.queryByText('Fiche ouverte')).toBeNull();
  });
});
