/**
 * Tests du formulaire abonnement.
 *
 * Le point central est la **non-régression du pré-remplissage** en
 * modification : un administrateur qui clique « Modifier » puis
 * « Enregistrer » sans rien changer ne doit **rien** modifier. C'est
 * précisément ce que la vérification manuelle de 7.3 a mis en doute — la
 * cause s'est avérée être une saisie manuelle, mais ce test verrouille le
 * comportement pour ne pas laisser la question rouvrable.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FormulaireAbonnement from './FormulaireAbonnement';
import type { Abonnement } from '../abonnement.types';

const ENTREPRISES = [{ id_client: 1, raison_sociale: 'Société A' }];

const ABONNEMENT_CONSOMMATION_REELLE: Abonnement = {
  id_abonnement: 397,
  date_debut: '2026-01-01',
  date_fin: '2026-12-31',
  type_facturation: 'Consommation_reelle',
  mode_suivi: 'Individuel',
  nombre_repas_inclus: null,
  tarif_forfait: null,
  tarif_unitaire_repas: '2500.00',
  id_client_entreprise: 42,
};

const ABONNEMENT_FORFAIT: Abonnement = {
  id_abonnement: 398,
  date_debut: '2026-02-01',
  date_fin: '2027-01-31',
  type_facturation: 'Forfait',
  mode_suivi: 'Global',
  nombre_repas_inclus: 100,
  tarif_forfait: '500000.00',
  tarif_unitaire_repas: null,
  id_client_entreprise: 43,
};

function afficher(surcharge: Partial<Parameters<typeof FormulaireAbonnement>[0]> = {}) {
  const surEnvoi = vi.fn();
  render(
    <FormulaireAbonnement
      entreprises={ENTREPRISES}
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

describe('modification sans changement — non-régression', () => {
  it('pré-remplit tous les champs d’un abonnement Consommation_reelle', () => {
    afficher({ abonnement: ABONNEMENT_CONSOMMATION_REELLE });

    expect(screen.getByLabelText(/date de début/i)).toHaveProperty(
      'value',
      '2026-01-01'
    );
    expect(screen.getByLabelText(/date de fin/i)).toHaveProperty('value', '2026-12-31');
    expect(screen.getByLabelText(/type de facturation/i)).toHaveProperty(
      'value',
      'Consommation_reelle'
    );
    expect(screen.getByLabelText(/mode de suivi/i)).toHaveProperty(
      'value',
      'Individuel'
    );
    expect(screen.getByLabelText(/tarif unitaire par repas/i)).toHaveProperty(
      'value',
      '2500.00'
    );
  });

  it('renvoie exactement les mêmes valeurs si rien n’est modifié (Consommation_reelle)', async () => {
    const surEnvoi = afficher({ abonnement: ABONNEMENT_CONSOMMATION_REELLE });

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]).toMatchObject({
      date_debut: '2026-01-01',
      date_fin: '2026-12-31',
      type_facturation: 'Consommation_reelle',
      mode_suivi: 'Individuel',
      tarif_unitaire_repas: '2500.00',
      tarif_forfait: null,
    });
  });

  it('pré-remplit tous les champs d’un abonnement Forfait', () => {
    afficher({ abonnement: ABONNEMENT_FORFAIT });

    expect(screen.getByLabelText(/date de début/i)).toHaveProperty(
      'value',
      '2026-02-01'
    );
    expect(screen.getByLabelText(/date de fin/i)).toHaveProperty('value', '2027-01-31');
    expect(screen.getByLabelText(/type de facturation/i)).toHaveProperty(
      'value',
      'Forfait'
    );
    expect(screen.getByLabelText(/mode de suivi/i)).toHaveProperty('value', 'Global');
    expect(screen.getByLabelText(/tarif forfait/i)).toHaveProperty(
      'value',
      '500000.00'
    );
    expect(screen.getByLabelText(/nombre de repas inclus/i)).toHaveProperty(
      'value',
      '100'
    );
  });

  it('renvoie exactement les mêmes valeurs si rien n’est modifié (Forfait)', async () => {
    const surEnvoi = afficher({ abonnement: ABONNEMENT_FORFAIT });

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]).toMatchObject({
      date_debut: '2026-02-01',
      date_fin: '2027-01-31',
      type_facturation: 'Forfait',
      mode_suivi: 'Global',
      tarif_forfait: '500000.00',
      nombre_repas_inclus: 100,
      tarif_unitaire_repas: null,
    });
  });

  it('ne montre pas le sélecteur d’entreprise en modification', () => {
    afficher({ abonnement: ABONNEMENT_CONSOMMATION_REELLE });

    expect(screen.queryByLabelText(/entreprise cliente/i)).toBeNull();
  });
});
