/**
 * Tests de la carte.
 *
 * L'accessibilité au clavier est le point qui compte : la version d'origine
 * posait `role="button"` et `tabIndex` sans gestionnaire clavier — une carte
 * annoncée comme un bouton, focusable, mais qui ne réagissait qu'à la souris.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Carte from './Carte';

afterEach(cleanup);

describe('rendu', () => {
  it('affiche titre, description et contenu', () => {
    render(
      <Carte titre="Chambre double" description="2 personnes">
        <p>contenu libre</p>
      </Carte>
    );

    expect(screen.getByRole('heading', { name: 'Chambre double' })).toBeDefined();
    expect(screen.getByText('2 personnes')).toBeDefined();
    expect(screen.getByText('contenu libre')).toBeDefined();
  });

  it('accepte une description nulle sans rien afficher', () => {
    // `PRODUIT.description` est nullable : le cas vient de la base, pas d'un
    // oubli d'appelant.
    const { container } = render(<Carte titre="x" description={null} />);

    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('donne à l’image un texte alternatif vide', () => {
    // L'image est décorative et le titre est lu juste en dessous : le répéter
    // ferait entendre deux fois la même chose à un lecteur d'écran.
    const { container } = render(<Carte titre="Éclair" image="https://x/i.jpg" />);

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});

describe('carte non cliquable', () => {
  it('n’est ni un bouton ni focusable', () => {
    // Sans action, annoncer un rôle de bouton promettrait une interaction qui
    // n'existe pas.
    const { container } = render(<Carte titre="x" />);
    const racine = container.firstElementChild;

    expect(racine?.getAttribute('role')).toBeNull();
    expect(racine?.getAttribute('tabindex')).toBeNull();
  });
});

describe('carte cliquable', () => {
  it('réagit au clic', async () => {
    const action = vi.fn();
    render(<Carte titre="x" surClic={action} />);

    await userEvent.click(screen.getByRole('button'));

    expect(action).toHaveBeenCalledOnce();
  });

  it('réagit à Entrée et à Espace', async () => {
    // **Le défaut corrigé.** Un élément annoncé comme bouton et focusable doit
    // s'actionner au clavier, sinon la promesse faite aux technologies
    // d'assistance n'est pas tenue.
    const action = vi.fn();
    render(<Carte titre="x" surClic={action} />);
    screen.getByRole('button').focus();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(action).toHaveBeenCalledTimes(2);
  });

  it('est atteignable au clavier', async () => {
    render(<Carte titre="x" surClic={vi.fn()} />);

    await userEvent.tab();

    expect(document.activeElement).toBe(screen.getByRole('button'));
  });

  it('ignore les autres touches', async () => {
    const action = vi.fn();
    render(<Carte titre="x" surClic={action} />);
    screen.getByRole('button').focus();

    await userEvent.keyboard('{Escape}a');

    expect(action).not.toHaveBeenCalled();
  });
});
