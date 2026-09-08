/**
 * Tests de la carte d'une session.
 *
 * Deux exigences distinctes.
 *
 * **Le formateur** : nom et spécialité affichés, e-mail et téléphone jamais.
 * La garantie est déjà portée par `FormateurPublic` côté serveur et par le type
 * TypeScript ; ce test ajoute la troisième barrière en injectant délibérément
 * des champs interdits — c'est la seule façon de prouver que le composant ne les
 * afficherait pas si l'API se mettait à les renvoyer.
 *
 * **Une session complète reste visible** mais non réservable, et le dit.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import type { SessionFormation, StatutSessionFormation } from '../formation.types';
import CarteSession from './CarteSession';

const NOM = 'Randriamampionona';
const EMAIL = 'solofo@delta.mg';
const TELEPHONE = '+261340999888';

function session(surcharge: Partial<SessionFormation> = {}): SessionFormation {
  return {
    id_session: 7,
    date_debut: '2026-09-01',
    date_fin: '2026-09-05',
    places_restantes: 5,
    statut: 'Ouverte',
    id_formation: 1,
    formateur: null,
    ...surcharge,
  };
}

function afficher(donnees: SessionFormation, proposeHebergement = false): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <CarteSession session={donnees} proposeHebergement={proposeHebergement} />
    </MemoryRouter>
  );
  return container;
}

beforeEach(effacerJeton);
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('formateur', () => {
  it('affiche le nom, le prénom et la spécialité', () => {
    // Le nom est un argument commercial : il décide un client à s'inscrire.
    afficher(
      session({
        formateur: { nom: NOM, prenom: 'Solofo', specialite: 'Entremets' },
      })
    );

    expect(screen.getByText(/Solofo Randriamampionona/)).toBeDefined();
    expect(screen.getByText(/Entremets/)).toBeDefined();
  });

  it('n’affiche rien quand aucun formateur n’est affecté', () => {
    // « Pas encore affecté » n'est pas une information utile au client.
    const conteneur = afficher(session());

    expect(conteneur.textContent).not.toMatch(/animée par/i);
  });

  it('ne divulgue ni e-mail ni téléphone', () => {
    // Champs délibérément injectés hors du type : ils ne peuvent pas venir de
    // l'API, mais on prouve ici que le composant ne les rendrait pas.
    const pollue = session({
      formateur: {
        nom: NOM,
        prenom: 'Solofo',
        specialite: 'Entremets',
        email: EMAIL,
        telephone: TELEPHONE,
        est_administrateur: true,
      },
    } as unknown as Partial<SessionFormation>);

    const conteneur = afficher(pollue);

    const rendu = conteneur.textContent ?? '';
    for (const interdit of [EMAIL, TELEPHONE, 'delta.mg', '261340']) {
      expect(rendu).not.toContain(interdit);
    }
  });
});

describe('disponibilité', () => {
  it('propose le formulaire sur une session réservable', () => {
    enregistrerSession('jeton.de.test', 'client');

    afficher(session());

    expect(screen.getByRole('button', { name: /réserver/i })).toBeDefined();
  });

  it('affiche une session complète sans la rendre réservable', () => {
    // Le client doit pouvoir constater qu'elle existe et attendre la suivante.
    enregistrerSession('jeton.de.test', 'client');

    afficher(session({ places_restantes: 0 }));

    expect(screen.getByText(/complète/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /réserver/i })).toBeNull();
  });

  it.each(['Planifiee', 'Terminee', 'Annulee'] as StatutSessionFormation[])(
    'n’offre pas de réservation sur une session %s',
    (statut) => {
      enregistrerSession('jeton.de.test', 'client');

      afficher(session({ statut }));

      expect(screen.queryByRole('button', { name: /réserver/i })).toBeNull();
    }
  );

  it('affiche le nombre de places restantes', () => {
    afficher(session({ places_restantes: 3 }));

    expect(screen.getByText(/3 place/)).toBeDefined();
  });
});
