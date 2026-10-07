/** Tests de la demande de personnalisation lue par l'équipe. */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import DemandePersonnalisationLue from './DemandePersonnalisationLue';

afterEach(cleanup);

it('affiche la demande, les ingrédients et le supplément figé', () => {
  render(
    <DemandePersonnalisationLue
      personnalisation={{
        description_demande: 'Message à écrire : Bonne fête\nThème et couleurs : bleu',
        ingredients_specifiques: 'sans fruits à coque',
        supplement_prix: '5000.00',
      }}
      quantite={2}
    />
  );

  expect(screen.getByText('Personnalisation demandée')).toBeDefined();
  expect(screen.getByText(/Message à écrire : Bonne fête/)).toBeDefined();
  expect(screen.getByText(/sans fruits à coque/)).toBeDefined();
  expect(
    screen.getByText(/Supplément : 5\s000,00 Ar × 2 = 10\s000,00 Ar/)
  ).toBeDefined();
});

it('tait le supplément quand il est nul', () => {
  render(
    <DemandePersonnalisationLue
      personnalisation={{
        description_demande: 'Message à écrire : Merci',
        ingredients_specifiques: null,
        supplement_prix: '0.00',
      }}
      quantite={1}
    />
  );

  expect(screen.queryByText(/Supplément/)).toBeNull();
  expect(screen.queryByText(/Ingrédients/)).toBeNull();
});
