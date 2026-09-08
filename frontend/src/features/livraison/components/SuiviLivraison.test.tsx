/**
 * Tests de l'encart de suivi.
 *
 * Deux exigences distinctes y sont vérifiées.
 *
 * Les **quatre statuts** du parcours affichent un libellé lisible, et `Echouee`
 * dit explicitement au client qu'il n'a rien à faire.
 *
 * Et **aucune identité de livreur n'atteint l'écran**. La garantie est déjà
 * portée par le serveur, qui répond avec un schema restreint, et par le type
 * TypeScript, qui ne déclare pas ces champs. Ce test ajoute la troisième
 * barrière : on injecte délibérément des champs interdits dans les données pour
 * vérifier que le composant ne les rend pas — c'est la seule façon de prouver
 * qu'il ne les afficherait pas si l'API se mettait à les renvoyer.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { StatutLivraison, SuiviLivraison as Suivi } from '../livraison.types';
import SuiviLivraison from './SuiviLivraison';

function suivi(surcharge: Partial<Suivi> = {}): Suivi {
  return {
    statut: 'En_attente',
    date_heure_prevue: null,
    date_heure_reelle: null,
    ...surcharge,
  };
}

afterEach(cleanup);

describe('les quatre statuts du parcours', () => {
  it.each([
    ['En_attente', /en préparation/i],
    ['En_cours', /en cours de livraison/i],
    ['Livree', /livrée/i],
    ['Echouee', /non aboutie/i],
  ] as [StatutLivraison, RegExp][])('%s affiche un libellé clair', (statut, motif) => {
    render(<SuiviLivraison suivi={suivi({ statut })} />);

    expect(screen.getByRole('heading', { level: 3 }).textContent).toMatch(motif);
  });

  it.each(['En_attente', 'En_cours', 'Livree', 'Echouee'] as StatutLivraison[])(
    '%s ne montre aucun identifiant technique',
    (statut) => {
      render(<SuiviLivraison suivi={suivi({ statut })} />);

      const texte = screen.getByLabelText('Suivi de livraison').textContent ?? '';
      expect(texte).not.toContain(statut);
      expect(texte).not.toContain('_');
    }
  );

  it('dit au client qu’un échec ne demande aucune démarche de sa part', () => {
    // Le point central de l'issue : l'administrateur traite la suite.
    render(<SuiviLivraison suivi={suivi({ statut: 'Echouee' })} />);

    expect(screen.getByText(/aucune démarche à faire/i)).toBeDefined();
  });

  it('n’invite pas à agir sur un échec, contrairement à une annulation', () => {
    const { unmount } = render(<SuiviLivraison suivi={suivi({ statut: 'Echouee' })} />);
    expect(screen.queryByText(/repasser commande/i)).toBeNull();
    unmount();

    render(<SuiviLivraison suivi={suivi({ statut: 'Annulee' })} />);
    expect(screen.getByText(/repasser commande/i)).toBeDefined();
  });
});

describe('confidentialité', () => {
  it('n’affiche ni identité, ni contact de livreur, ni adresse', () => {
    // Champs délibérément injectés hors du type : ils ne peuvent pas venir de
    // l'API, mais on prouve ici que le composant ne les rendrait pas.
    const pollue = {
      ...suivi({ statut: 'En_cours' }),
      id_personnel: 42,
      livreur: { nom: 'Randriamampionona', prenom: 'Solofo' },
      nom_livreur: 'Randriamampionona',
      telephone_livreur: '+261340999888',
      adresse_livraison: 'Lot II M 45 Antananarivo',
    } as unknown as Suivi;

    const { container } = render(<SuiviLivraison suivi={pollue} />);

    const rendu = container.textContent ?? '';
    for (const interdit of [
      'Randriamampionona',
      'Solofo',
      '+261340999888',
      'Lot II M 45',
      '42',
    ]) {
      expect(rendu).not.toContain(interdit);
    }
  });
});

describe('dates', () => {
  it('n’affiche rien tant que la tournée n’est pas planifiée', () => {
    // Une ligne vide se lirait comme une donnée manquante ; son absence non.
    render(<SuiviLivraison suivi={suivi()} />);

    expect(screen.queryByText(/prévue le/i)).toBeNull();
    expect(screen.queryByText(/remise le/i)).toBeNull();
  });

  it('affiche la date prévue quand elle existe', () => {
    render(
      <SuiviLivraison
        suivi={suivi({ date_heure_prevue: '2026-08-05T14:00:00+00:00' })}
      />
    );

    expect(screen.getByText(/prévue le/i)).toBeDefined();
    expect(screen.getByText(/août 2026/i)).toBeDefined();
  });

  it('affiche la date de remise sur une livraison aboutie', () => {
    render(
      <SuiviLivraison
        suivi={suivi({
          statut: 'Livree',
          date_heure_reelle: '2026-08-05T16:30:00+00:00',
        })}
      />
    );

    expect(screen.getByText(/remise le/i)).toBeDefined();
  });
});
