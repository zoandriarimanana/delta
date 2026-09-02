/**
 * Tests du tunnel de commande.
 *
 * Le point le plus important est le dernier bloc : après une commande invitée,
 * la référence publique doit être présentée. C'est le seul chemin de retour de
 * l'invité vers sa commande.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import {
  creerCommande,
  creerCommandeInvite,
  recupererCommandeInvitee,
} from '../commande.api';
import { ecrirePanier, lirePanier, resynchroniserPanier } from '../commande.panier';
import type { Commande } from '../commande.types';
import CommandeInviteePage from './CommandeInviteePage';
import TunnelCommandePage from './TunnelCommandePage';

vi.mock('../commande.api');

const REFERENCE = '8f14e45f-ceea-467a-9f5a-1f0a1f0a1f0a';

const COMMANDE_INVITEE: Commande = {
  id_commande: 7,
  date_commande: '2026-07-29T09:30:00+00:00',
  reference_publique: REFERENCE,
  type_commande: 'A_emporter',
  statut: 'En_attente',
  montant_total: '7.00',
  id_client: null,
  nom_invite: 'Rakoto Jean',
  contact_invite: '+261340000000',
  lignes: [
    {
      id_ligne: 1,
      id_produit: 1,
      nom_produit: 'Éclair',
      quantite: 2,
      prix_unitaire_applique: '3.50',
    },
  ],
};

const COMMANDE_CLIENT: Commande = {
  ...COMMANDE_INVITEE,
  reference_publique: null,
  id_client: 3,
  nom_invite: null,
  contact_invite: null,
};

function remplirLePanier() {
  ecrirePanier([
    {
      id_produit: 1,
      nom: 'Éclair',
      prix_unitaire: '3.50',
      unite_mesure: 'piece',
      quantite: 2,
      stock_disponible: 10,
    },
  ]);
}

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/commande']}>
      <Routes>
        <Route path="/commande" element={<TunnelCommandePage />} />
        <Route path="/commandes/invite/:reference" element={<CommandeInviteePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  resynchroniserPanier();
  effacerJeton();
  vi.mocked(creerCommande).mockResolvedValue(COMMANDE_CLIENT);
  vi.mocked(creerCommandeInvite).mockResolvedValue(COMMANDE_INVITEE);
  vi.mocked(recupererCommandeInvitee).mockResolvedValue(COMMANDE_INVITEE);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  resynchroniserPanier();
});

describe('panier vide', () => {
  it('annonce qu’il n’y a rien à commander', () => {
    afficher();

    expect(screen.getByText(/panier est vide/i)).toBeDefined();
  });
});

describe('parcours invité', () => {
  it('demande l’identité quand aucun jeton n’est présent', () => {
    act(remplirLePanier);

    afficher();

    expect(screen.getByLabelText('Nom')).toBeDefined();
    expect(screen.getByLabelText(/téléphone ou e-mail/i)).toBeDefined();
  });

  it('affiche la référence publique après validation', async () => {
    // Le critère central reporté de #14 : sans elle, l'invité perd
    // définitivement l'accès à sa commande.
    act(remplirLePanier);
    afficher();

    await userEvent.type(screen.getByLabelText('Nom'), 'Rakoto Jean');
    await userEvent.type(
      screen.getByLabelText(/téléphone ou e-mail/i),
      '+261340000000'
    );
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    const reference = await screen.findByTestId('reference-publique');
    expect(reference.textContent).toBe(REFERENCE);
  });

  it('propose aussi le lien direct vers la commande', async () => {
    act(remplirLePanier);
    afficher();

    await userEvent.type(screen.getByLabelText('Nom'), 'Rakoto');
    await userEvent.type(screen.getByLabelText(/téléphone ou e-mail/i), '0340');
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    const lien = await screen.findByRole('link', {
      name: new RegExp(REFERENCE),
    });
    expect(lien.getAttribute('href')).toContain(REFERENCE);
  });
});

describe('parcours connecté', () => {
  it('ne demande pas d’identité', () => {
    enregistrerSession('jeton.de.test', 'client');
    act(remplirLePanier);

    afficher();

    expect(screen.queryByLabelText('Nom')).toBeNull();
  });

  it('confirme sans référence publique', async () => {
    enregistrerSession('jeton.de.test', 'client');
    act(remplirLePanier);
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    expect(await screen.findByText(/commande enregistrée/i)).toBeDefined();
    expect(screen.queryByTestId('reference-publique')).toBeNull();
  });
});

describe('échec de validation', () => {
  it('affiche le message et conserve le panier', async () => {
    vi.mocked(creerCommandeInvite).mockRejectedValue({
      response: { data: { detail: 'Stock insuffisant pour « Éclair ».' } },
    });
    act(remplirLePanier);
    afficher();

    await userEvent.type(screen.getByLabelText('Nom'), 'Rakoto');
    await userEvent.type(screen.getByLabelText(/téléphone ou e-mail/i), '0340');
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toContain('Stock insuffisant');

    // La sélection n'a pas été perdue. On l'affirme sur le panier lui-même :
    // chercher « Éclair » à l'écran serait ambigu, le nom du produit figure
    // aussi dans le message d'erreur.
    expect(lirePanier()).toHaveLength(1);
    expect(lirePanier()[0]?.quantite).toBe(2);
    // Et le formulaire reste disponible pour réessayer.
    expect(screen.getByRole('button', { name: /valider/i })).toBeDefined();
  });
});
