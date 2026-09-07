/**
 * Tests du formulaire personnel.
 *
 * Le point central est la **non-régression du pré-remplissage** en
 * modification : un administrateur qui ouvre « Modifier » puis
 * « Enregistrer » sans rien changer ne doit renvoyer que les valeurs déjà
 * présentes — même précaution que `FormulaireAbonnement`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FormulairePersonnel from './FormulairePersonnel';
import type { Personnel } from '../personnel.types';

const RAKOTO: Personnel = {
  id_personnel: 7,
  nom: 'Rakoto',
  prenom: 'Jean',
  fonction: 'Formateur',
  email: 'jean.rakoto@delta.mg',
  telephone: '+261340000000',
  date_embauche: '2024-03-01',
  specialite: 'Pâtisserie',
  zone_livraison: null,
  est_administrateur: false,
};

function afficher(surcharge: Partial<Parameters<typeof FormulairePersonnel>[0]> = {}) {
  const surEnvoi = vi.fn();
  render(
    <FormulairePersonnel
      envoi={false}
      erreur={null}
      surEnvoi={surEnvoi}
      surAnnulation={vi.fn()}
      {...surcharge}
    />
  );
  return surEnvoi;
}

afterEach(cleanup);

describe('création', () => {
  it('affiche « Créer » et des champs vides', () => {
    afficher();

    expect(screen.getByRole('button', { name: /créer/i })).toBeTruthy();
    expect(screen.getByLabelText(/^nom$/i)).toHaveProperty('value', '');
  });

  it('envoie null plutôt qu’une chaîne vide pour les champs facultatifs', async () => {
    const surEnvoi = afficher();

    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Rabe');
    await userEvent.type(screen.getByLabelText(/^prénom$/i), 'Marie');
    await userEvent.type(
      screen.getByLabelText(/e-mail professionnel/i),
      'marie@delta.mg'
    );
    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]).toMatchObject({
      nom: 'Rabe',
      prenom: 'Marie',
      email: 'marie@delta.mg',
      telephone: null,
      date_embauche: null,
      specialite: null,
      zone_livraison: null,
    });
  });
});

describe('modification sans changement — non-régression', () => {
  it('pré-remplit tous les champs', () => {
    afficher({ personnel: RAKOTO });

    expect(screen.getByLabelText(/^nom$/i)).toHaveProperty('value', 'Rakoto');
    expect(screen.getByLabelText(/^prénom$/i)).toHaveProperty('value', 'Jean');
    expect(screen.getByLabelText(/fonction/i)).toHaveProperty('value', 'Formateur');
    expect(screen.getByLabelText(/e-mail professionnel/i)).toHaveProperty(
      'value',
      'jean.rakoto@delta.mg'
    );
    expect(screen.getByLabelText(/téléphone/i)).toHaveProperty(
      'value',
      '+261340000000'
    );
    expect(screen.getByLabelText(/spécialité/i)).toHaveProperty('value', 'Pâtisserie');
  });

  it('renvoie exactement les mêmes valeurs si rien n’est modifié', async () => {
    const surEnvoi = afficher({ personnel: RAKOTO });

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]).toMatchObject({
      nom: 'Rakoto',
      prenom: 'Jean',
      fonction: 'Formateur',
      email: 'jean.rakoto@delta.mg',
      telephone: '+261340000000',
      date_embauche: '2024-03-01',
      specialite: 'Pâtisserie',
      zone_livraison: null,
    });
  });

  it('affiche « Enregistrer » plutôt que « Créer »', () => {
    afficher({ personnel: RAKOTO });

    expect(screen.getByRole('button', { name: /^enregistrer$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^créer$/i })).toBeNull();
  });
});

describe('erreur', () => {
  it('affiche le message repris tel quel', () => {
    afficher({ erreur: 'Un membre du personnel actif utilise déjà cette adresse.' });

    expect(screen.getByRole('alert').textContent).toContain(
      'Un membre du personnel actif utilise déjà cette adresse.'
    );
  });
});
