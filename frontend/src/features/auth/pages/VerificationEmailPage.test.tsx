import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import { renvoyerCode, verifierEmail } from '../auth.api';
import VerificationEmailPage from './VerificationEmailPage';

vi.mock('../auth.api');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function afficher() {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/verification', state: { email: 'rasoa@example.mg' } },
      ]}
    >
      <Routes>
        <Route path="/verification" element={<VerificationEmailPage />} />
        <Route path="/connexion" element={<p>page de connexion</p>} />
      </Routes>
    </MemoryRouter>
  );
}

it('reprend l’adresse de l’inscription et active le compte avec le code', async () => {
  vi.mocked(verifierEmail).mockResolvedValue(undefined);
  afficher();

  expect(screen.getByLabelText(/adresse e-mail/i)).toHaveProperty(
    'value',
    'rasoa@example.mg'
  );
  await userEvent.type(screen.getByLabelText(/code reçu/i), '12a34 56');
  await userEvent.click(screen.getByRole('button', { name: /activer mon compte/i }));

  expect(verifierEmail).toHaveBeenCalledWith('rasoa@example.mg', '123456');
  expect(await screen.findByText('page de connexion')).toBeDefined();
});

it('reprend le refus du serveur', async () => {
  vi.mocked(verifierEmail).mockRejectedValue({
    response: { status: 422, data: { detail: 'Code incorrect ou expiré.' } },
  });
  afficher();

  await userEvent.type(screen.getByLabelText(/code reçu/i), '000000');
  await userEvent.click(screen.getByRole('button', { name: /activer mon compte/i }));

  expect((await screen.findByRole('alert')).textContent).toContain('Code incorrect');
});

it('renvoie un code avec un message qui ne trahit aucun compte', async () => {
  vi.mocked(renvoyerCode).mockResolvedValue(undefined);
  afficher();

  await userEvent.click(screen.getByRole('button', { name: /renvoyer le code/i }));

  await waitFor(() => expect(renvoyerCode).toHaveBeenCalledWith('rasoa@example.mg'));
  expect((await screen.findByRole('status')).textContent).toMatch(/si un compte/i);
});
