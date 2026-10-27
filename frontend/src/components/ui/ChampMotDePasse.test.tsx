/** Tests du champ de mot de passe — primitive présentationnelle. */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import ChampMotDePasse from './ChampMotDePasse';

afterEach(cleanup);

function Formulaire() {
  const [valeur, setValeur] = useState('');
  return (
    <label>
      Mot de passe
      <ChampMotDePasse value={valeur} onChange={(e) => setValeur(e.target.value)} />
    </label>
  );
}

describe('ChampMotDePasse', () => {
  it('est masqué par défaut', () => {
    render(<Formulaire />);

    expect(screen.getByLabelText('Mot de passe').getAttribute('type')).toBe('password');
    expect(
      screen
        .getByRole('button', { name: 'Afficher la saisie' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('l’œil affiche puis masque la saisie, sans la perdre', async () => {
    const utilisateur = userEvent.setup();
    render(<Formulaire />);
    const champ = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    await utilisateur.type(champ, 'secret-123');

    await utilisateur.click(screen.getByRole('button', { name: 'Afficher la saisie' }));
    expect(champ.getAttribute('type')).toBe('text');
    expect(champ.value).toBe('secret-123');

    await utilisateur.click(screen.getByRole('button', { name: 'Masquer la saisie' }));
    expect(champ.getAttribute('type')).toBe('password');
    expect(champ.value).toBe('secret-123');
  });

  it('le bouton n’envoie pas le formulaire', async () => {
    let envois = 0;
    const utilisateur = userEvent.setup();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envois += 1;
        }}
      >
        <ChampMotDePasse aria-label="Mot de passe" defaultValue="x" />
      </form>
    );

    await utilisateur.click(screen.getByRole('button', { name: 'Afficher la saisie' }));

    expect(envois).toBe(0);
  });

  it('ne se confond pas avec le champ dans une recherche par libellé', () => {
    render(<Formulaire />);

    expect(screen.getAllByLabelText(/mot de passe/i)).toHaveLength(1);
  });

  it('transmet les attributs du champ (required, autoComplete, minLength)', () => {
    render(
      <ChampMotDePasse
        aria-label="Mot de passe"
        required
        autoComplete="new-password"
        minLength={8}
      />
    );
    const champ = screen.getByLabelText('Mot de passe');

    expect(champ.hasAttribute('required')).toBe(true);
    expect(champ.getAttribute('autocomplete')).toBe('new-password');
    expect(champ.getAttribute('minlength')).toBe('8');
  });
});
