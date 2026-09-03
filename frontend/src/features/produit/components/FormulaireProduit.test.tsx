/**
 * Tests du formulaire produit.
 *
 * Le point central est la **règle croisée** du MLD : un produit personnalisable
 * doit porter un tarif. Le serveur la garantit — un `CHECK` en base, doublé du
 * schema d'entrée — et refuse en 422. L'écran la reflète pour que l'utilisateur
 * ne découvre pas le refus après avoir tout saisi.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FormulaireProduit from './FormulaireProduit';

const CATEGORIES = [
  { id_categorie: 1, libelle: 'Pâtisserie', supprime_le: null },
  { id_categorie: 2, libelle: 'Archivée', supprime_le: '2026-09-03T08:00:00Z' },
];

function afficher(surcharge: Partial<Parameters<typeof FormulaireProduit>[0]> = {}) {
  const surEnvoi = vi.fn();
  render(
    <FormulaireProduit
      categories={CATEGORIES}
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
  it('n’offre que les catégories actives', () => {
    // Rattacher un produit à une catégorie archivée créerait une incohérence
    // que rien ne rattraperait à l'affichage.
    afficher();

    expect(screen.getByRole('option', { name: 'Pâtisserie' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Archivée' })).toBeNull();
  });

  it('envoie la charge utile, description vide normalisée en null', async () => {
    // Le serveur attend une absence, pas une chaîne : `""` n'est pas une
    // description.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Éclair');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]).toMatchObject({
      nom: 'Éclair',
      description: null,
      id_categorie: 1,
    });
  });
});

describe('règle personnalisable ⇒ tarif', () => {
  it('n’affiche le tarif que si le produit est personnalisable', async () => {
    afficher();

    expect(screen.queryByLabelText(/supplément/i)).toBeNull();

    await userEvent.click(screen.getByLabelText(/personnalisable/i));

    expect(screen.getByLabelText(/supplément/i)).toBeDefined();
  });

  it('bloque l’envoi tant que le tarif manque', async () => {
    // Le serveur refuserait en 422 : laisser envoyer ferait découvrir le refus
    // après coup.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Gâteau');
    await userEvent.click(screen.getByLabelText(/personnalisable/i));

    expect(screen.getByRole('button', { name: /créer/i })).toHaveProperty(
      'disabled',
      true
    );
    expect(surEnvoi).not.toHaveBeenCalled();
  });

  it('débloque dès que le tarif est saisi', async () => {
    // Contrôle positif : sans lui, un formulaire toujours bloqué passerait le
    // test précédent.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Gâteau');
    await userEvent.click(screen.getByLabelText(/personnalisable/i));
    await userEvent.type(screen.getByLabelText(/supplément/i), '5.00');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    const envoye = surEnvoi.mock.calls[0]?.[0];
    expect(envoye?.est_personnalisable).toBe(true);
    // La **valeur** et non la chaîne exacte : un `input[type=number]` normalise
    // sa saisie — « 5.00 » devient « 5 », « 5.50 » devient « 5.5 ». Les
    // décimales significatives survivent, et le serveur reçoit un `Decimal`
    // valide dans les deux cas. Asserter la chaîne testerait le navigateur.
    expect(Number(envoye?.supplement_personnalisation)).toBe(5);
  });

  it('n’envoie aucun tarif pour un produit non personnalisable', async () => {
    // `null` signifie « non personnalisable », et rien d'autre : envoyer un
    // tarif dormant contredirait le champ.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^nom$/i), 'Éclair');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]?.supplement_personnalisation).toBeNull();
  });
});

describe('modification', () => {
  const PRODUIT = {
    id_produit: 7,
    nom: 'Mille-feuille',
    description: 'Feuilleté',
    prix_unitaire: '5.00',
    unite_mesure: 'piece',
    stock_disponible: 4,
    est_personnalisable: true,
    supplement_personnalisation: '2.00',
    est_livrable: true,
    id_categorie: 1,
  };

  it('préremplit les champs du produit', () => {
    afficher({ produit: PRODUIT });

    expect(screen.getByLabelText(/^nom$/i)).toHaveProperty('value', 'Mille-feuille');
    expect(screen.getByLabelText(/supplément/i)).toHaveProperty('value', '2.00');
  });

  it('libelle le bouton différemment de la création', () => {
    // Le même formulaire sert les deux : le libellé est le seul indice, il doit
    // être juste.
    afficher({ produit: PRODUIT });

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^créer$/i })).toBeNull();
  });
});

describe('refus', () => {
  it('affiche le message du serveur tel quel', () => {
    afficher({ erreur: 'Un produit porte déjà ce nom.' });

    expect(screen.getByRole('alert').textContent).toBe('Un produit porte déjà ce nom.');
  });
});
