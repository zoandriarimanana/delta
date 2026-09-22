/**
 * Tests du formulaire logement.
 *
 * Le point central : le champ `statut` n'apparaît **qu'en modification**.
 * `LogementCreate` côté serveur ne l'accepte pas — un logement naît toujours
 * `Disponible` — et l'afficher à la création laisserait croire à un choix que
 * le serveur ignorerait. Même patron que `FormulaireSalle.test.tsx`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FormulaireLogement from './FormulaireLogement';

function afficher(surcharge: Partial<Parameters<typeof FormulaireLogement>[0]> = {}) {
  const surEnvoi = vi.fn();
  render(
    <FormulaireLogement
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
  it('n’affiche pas le champ statut', () => {
    // Un logement naît toujours `Disponible` côté serveur : proposer un choix
    // ici laisserait croire à une option que la création ignore.
    afficher();

    expect(screen.queryByLabelText(/statut/i)).toBeNull();
  });

  it('envoie la charge utile sans statut', async () => {
    // `capacite` retombe à 1 dès qu'une valeur invalide transite par l'état
    // (garde `Math.max(1, ...)` du composant) : `clear` puis `type` ferait
    // donc réapparaître « 1 » avant la frappe suivante. Sélectionner le
    // contenu existant avant de taper évite ce piège.
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/type de chambre/i), 'Double');
    await userEvent.tripleClick(screen.getByLabelText(/capacité/i));
    await userEvent.keyboard('2');
    await userEvent.tripleClick(screen.getByLabelText(/tarif à la nuitée/i));
    await userEvent.keyboard('45000');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    const envoye = surEnvoi.mock.calls[0]?.[0];
    expect(envoye).toEqual({
      type_chambre: 'Double',
      capacite: 2,
      tarif_nuitee: '45000',
    });
    expect(envoye).not.toHaveProperty('statut');
  });
});

describe('modification', () => {
  const LOGEMENT = {
    id_logement: 7,
    type_chambre: 'Suite',
    capacite: 4,
    tarif_nuitee: '90000.00',
    statut: 'Disponible' as const,
    note_moyenne: null,
    nombre_avis: 0,
  };

  it('préremplit les champs du logement', () => {
    afficher({ logement: LOGEMENT });

    expect(screen.getByLabelText(/type de chambre/i)).toHaveProperty('value', 'Suite');
    expect(screen.getByLabelText(/tarif à la nuitée/i)).toHaveProperty(
      'value',
      '90000.00'
    );
  });

  it('affiche le champ statut, présélectionné sur le statut actuel', () => {
    afficher({ logement: { ...LOGEMENT, statut: 'En_maintenance' } });

    expect(screen.getByLabelText(/statut/i)).toHaveProperty('value', 'En_maintenance');
  });

  it('propose les trois valeurs du domaine', () => {
    // Regex ancrées : « indisponible » contient « disponible » comme
    // sous-chaîne, un motif non ancré confondrait les deux options.
    afficher({ logement: LOGEMENT });

    expect(
      screen.getByRole('option', { name: /^disponible à la réservation$/i })
    ).toBeDefined();
    expect(
      screen.getByRole('option', { name: /^temporairement indisponible$/i })
    ).toBeDefined();
    expect(screen.getByRole('option', { name: /^retiré de l.offre$/i })).toBeDefined();
  });

  it('inclut le nouveau statut choisi dans la charge utile envoyée', async () => {
    const surEnvoi = afficher({ logement: LOGEMENT });

    await userEvent.selectOptions(screen.getByLabelText(/statut/i), 'Hors_service');
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]?.statut).toBe('Hors_service');
  });

  it('libelle le bouton différemment de la création', () => {
    afficher({ logement: LOGEMENT });

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^créer$/i })).toBeNull();
  });
});

describe('refus', () => {
  it('affiche le message du serveur tel quel', () => {
    afficher({ erreur: 'Un logement porte déjà cette configuration.' });

    expect(screen.getByRole('alert').textContent).toBe(
      'Un logement porte déjà cette configuration.'
    );
  });
});
