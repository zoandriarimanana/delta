/** Tests du bouton — primitive présentationnelle, sans logique métier. */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Bouton from './Bouton';

afterEach(cleanup);

describe('rendu', () => {
  it('déclenche l’action au clic', async () => {
    const action = vi.fn();
    render(<Bouton onClick={action}>Valider</Bouton>);

    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(action).toHaveBeenCalledOnce();
  });

  it('distingue les deux variantes', () => {
    const { container: principal } = render(<Bouton>x</Bouton>);
    const classesPrincipal = principal.firstElementChild?.className ?? '';
    cleanup();
    const { container: secondaire } = render(<Bouton variante="secondaire">x</Bouton>);

    expect(secondaire.firstElementChild?.className).not.toBe(classesPrincipal);
  });

  it('vaut « button » par défaut, jamais « submit »', () => {
    // Un bouton sans type explicite vaut `submit` en HTML : posé dans un
    // formulaire, il le soumettrait sans qu'on l'ait demandé.
    render(<Bouton>x</Bouton>);

    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('laisse l’appelant imposer son type', () => {
    render(<Bouton type="submit">x</Bouton>);

    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
});

describe('état désactivé', () => {
  it('ne déclenche rien', async () => {
    const action = vi.fn();
    render(
      <Bouton onClick={action} disabled>
        Valider
      </Bouton>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(action).not.toHaveBeenCalled();
  });

  it('perd l’apparence de sa variante', () => {
    // Les classes désactivées suivent celles de la variante et l'emportent :
    // sans cela, un bouton principal désactivé garderait sa couleur pleine et
    // paraîtrait cliquable.
    const { container } = render(<Bouton disabled>x</Bouton>);
    const classes = container.firstElementChild?.className ?? '';

    expect(classes).toContain('cursor-not-allowed');
    expect(classes).not.toContain('bg-terracotta');
  });
});
