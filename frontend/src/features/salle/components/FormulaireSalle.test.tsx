/**
 * Tests du formulaire salle.
 *
 * Le point central est la **règle croisée** du MLD (#45) : une salle doit
 * porter au moins un tarif, horaire ou journalier. Le serveur la garantit —
 * un `CHECK` en base, doublé du schema d'entrée — et refuse en 422. L'écran
 * la reflète pour que l'utilisateur ne découvre pas le refus après avoir
 * tout saisi. Même patron que `FormulaireProduit.test.tsx`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FormulaireSalle from './FormulaireSalle';

function afficher(surcharge: Partial<Parameters<typeof FormulaireSalle>[0]> = {}) {
  const surEnvoi = vi.fn();
  render(
    <FormulaireSalle
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

describe('règle au moins un tarif', () => {
  it('bloque l’envoi tant qu’aucun tarif n’est saisi', async () => {
    // Le serveur refuserait en 422 : laisser envoyer ferait découvrir le
    // refus après coup.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Salle Zafy');
    await userEvent.clear(screen.getByLabelText(/^capacité$/i));
    await userEvent.type(screen.getByLabelText(/^capacité$/i), '10');

    expect(screen.getByRole('button', { name: /créer/i })).toHaveProperty(
      'disabled',
      true
    );
    expect(surEnvoi).not.toHaveBeenCalled();
  });

  it('débloque dès qu’un seul des deux tarifs est saisi', async () => {
    // Contrôle positif : sans lui, un formulaire toujours bloqué passerait
    // le test précédent.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Salle Zafy');
    await userEvent.type(screen.getByLabelText(/tarif horaire/i), '15000');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    const envoye = surEnvoi.mock.calls[0]?.[0];
    expect(Number(envoye?.tarif_horaire)).toBe(15000);
    expect(envoye?.tarif_journee).toBeNull();
  });

  it('accepte le tarif journalier seul, sans exiger l’horaire', async () => {
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Salle Zafy');
    await userEvent.type(screen.getByLabelText(/tarif journalier/i), '90000');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    const envoye = surEnvoi.mock.calls[0]?.[0];
    expect(envoye?.tarif_horaire).toBeNull();
    expect(Number(envoye?.tarif_journee)).toBe(90000);
  });
});

describe('modification', () => {
  const SALLE = {
    id_salle: 7,
    nom: 'Salle Andriana',
    capacite: 30,
    tarif_horaire: '20000.00',
    tarif_journee: null,
    equipements: 'Vidéoprojecteur',
    note_moyenne: null,
    nombre_avis: 0,
  };

  it('préremplit les champs de la salle', () => {
    afficher({ salle: SALLE });

    expect(screen.getByLabelText(/^nom$/i)).toHaveProperty('value', 'Salle Andriana');
    expect(screen.getByLabelText(/tarif horaire/i)).toHaveProperty('value', '20000.00');
  });

  it('libelle le bouton différemment de la création', () => {
    afficher({ salle: SALLE });

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^créer$/i })).toBeNull();
  });
});

describe('refus', () => {
  it('affiche le message du serveur tel quel', () => {
    afficher({ erreur: 'Une salle doit porter au moins un tarif.' });

    expect(screen.getByRole('alert').textContent).toBe(
      'Une salle doit porter au moins un tarif.'
    );
  });
});
