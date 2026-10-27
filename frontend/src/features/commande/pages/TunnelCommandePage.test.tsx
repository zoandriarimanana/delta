/**
 * Tests du tunnel de commande.
 *
 * Le point le plus important est le dernier bloc : après une commande invitée,
 * la référence publique doit être présentée. C'est le seul chemin de retour de
 * l'invité vers sa commande.
 */

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { definirSession, effacerSession } from '@/lib/session.store';

import {
  creerCommande,
  creerCommandeInvite,
  recupererCommandeInvitee,
} from '../commande.api';
import { recupererPhotos } from '@/features/galerie/galerie.api';
import { initierPaiement, simulerConfirmation } from '@/features/paiement/paiement.api';
import type { Paiement } from '@/features/paiement/paiement.types';
import { recupererTarifLivraison } from '@/features/livraison/livraison.api';

import { ecrirePanier, lirePanier, resynchroniserPanier } from '../commande.panier';
import type { Commande } from '../commande.types';
import CommandeInviteePage from './CommandeInviteePage';
import TunnelCommandePage from './TunnelCommandePage';

vi.mock('../commande.api');
vi.mock('@/features/paiement/paiement.api');
// Seule la lecture du tarif est simulée : la page de commande invitée appelle
// aussi le suivi de livraison, qui doit garder son comportement réel.
vi.mock('@/features/galerie/galerie.api', async (original) => ({
  ...(await original<typeof import('@/features/galerie/galerie.api')>()),
  recupererPhotos: vi.fn(),
}));
vi.mock('@/features/livraison/livraison.api', async (original) => ({
  ...(await original<typeof import('@/features/livraison/livraison.api')>()),
  recupererTarifLivraison: vi.fn(),
}));

const REFERENCE = '8f14e45f-ceea-467a-9f5a-1f0a1f0a1f0a';

const COMMANDE_INVITEE: Commande = {
  id_commande: 7,
  date_commande: '2026-07-29T09:30:00+00:00',
  reference_publique: REFERENCE,
  type_commande: 'A_emporter',
  statut: 'En_attente',
  montant_total: '7.00',
  frais_livraison: '0.00',
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
  rembourse_le: null,
};

const PAIEMENT: Paiement = {
  id_paiement: 1,
  montant: '7.00',
  methode: 'Mobile_money',
  fournisseur: 'Mvola',
  statut: 'En_attente',
  reference_externe: 'SIM-1',
  date_paiement: '2026-10-12T10:00:00Z',
  id_commande: 1,
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
  effacerSession();
  vi.mocked(creerCommande).mockResolvedValue(COMMANDE_CLIENT);
  vi.mocked(recupererPhotos).mockResolvedValue([]);
  vi.mocked(recupererTarifLivraison).mockResolvedValue({
    forfait: '5000.00',
    seuil_gratuite: '100000.00',
  });
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

  it('un invité paie dès la validation, par mobile money, sur la page de sa commande', async () => {
    vi.stubEnv('VITE_ENVIRONMENT', 'developpement');
    vi.mocked(initierPaiement).mockResolvedValue({ ...PAIEMENT, id_commande: 7 });
    vi.mocked(simulerConfirmation).mockResolvedValue({
      ...PAIEMENT,
      id_commande: 7,
      statut: 'Reussi',
    });
    act(remplirLePanier);
    afficher();

    await userEvent.type(screen.getByLabelText('Nom'), 'Rakoto Jean');
    await userEvent.type(
      screen.getByLabelText(/téléphone ou e-mail/i),
      '+261340000000'
    );
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    // Étape « Paiement » : le numéro de contact, mobile, est repris d'office.
    const numero = await screen.findByLabelText(/numéro mobile money/i);
    expect(numero).toHaveProperty('value', '034 00 000 00');
    vi.mocked(recupererCommandeInvitee).mockResolvedValue({
      ...COMMANDE_INVITEE,
      statut: 'Confirmee',
    });
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));
    await userEvent.click(await screen.findByRole('button', { name: /simuler/i }));

    expect(initierPaiement).toHaveBeenCalledWith(
      { type: 'invite', reference: REFERENCE },
      {
        methode: 'Mobile_money',
        fournisseur: 'Mvola',
        numero_mobile_money: '0340000000',
      }
    );
    // Commande relue, confirmée : la page passe à sa vue de confirmation.
    expect(
      await screen.findByRole('heading', { name: 'Votre commande' })
    ).toBeDefined();
    expect(screen.queryByLabelText(/numéro mobile money/i)).toBeNull();
    vi.unstubAllEnvs();
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
    definirSession('client');
    act(remplirLePanier);

    afficher();

    expect(screen.queryByLabelText('Nom')).toBeNull();
  });

  it('confirme sans référence publique', async () => {
    definirSession('client');
    act(remplirLePanier);
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    expect(await screen.findByText(/Commande n° \d+ enregistrée/)).toBeDefined();
    expect(screen.queryByTestId('reference-publique')).toBeNull();
  });
});

describe('devise de paiement', () => {
  it('reste en Ariary : aucun choix de devise, aucune devise envoyée', async () => {
    definirSession('client');
    act(remplirLePanier);
    afficher();

    expect(screen.queryByRole('radio', { name: /eur|usd/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    await screen.findByText(/Commande n° \d+ enregistrée/);
    expect(vi.mocked(creerCommande).mock.calls[0]?.[0]).not.toHaveProperty('devise');
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

describe('mode de réception et frais de livraison', () => {
  it('par défaut, retrait : aucune adresse envoyée, aucun frais', async () => {
    definirSession('client');
    act(remplirLePanier);
    afficher();

    expect(await screen.findByText('Aucun frais', { selector: 'dd' })).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    expect(creerCommande).toHaveBeenCalledWith({
      type_commande: 'A_emporter',
      lignes: [{ id_produit: 1, quantite: 2 }],
    });
  });

  it('la livraison exige une adresse, l’envoie et annonce les frais', async () => {
    definirSession('client');
    act(remplirLePanier);
    afficher();

    await userEvent.click(screen.getByLabelText(/Livraison à domicile/));
    expect(await screen.findByText(/5\s000,00 Ar/)).toBeDefined();
    expect(screen.getByText(/Plus que .* pour une livraison offerte/)).toBeDefined();

    const adresse = screen.getByLabelText(/Adresse de livraison/);
    expect(adresse.hasAttribute('required')).toBe(true);
    await userEvent.type(adresse, '  Lot II M 45 Antananarivo  ');
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    expect(creerCommande).toHaveBeenCalledWith({
      type_commande: 'En_ligne',
      lignes: [{ id_produit: 1, quantite: 2 }],
      adresse_livraison: 'Lot II M 45 Antananarivo',
    });
  });

  it('l’étape de paiement annonce le total, frais de livraison compris', async () => {
    vi.mocked(creerCommande).mockResolvedValue({
      ...COMMANDE_CLIENT,
      montant_total: '5007.00',
      frais_livraison: '5000.00',
    });
    definirSession('client');
    act(remplirLePanier);
    afficher();

    await userEvent.click(screen.getByLabelText(/Livraison à domicile/));
    await userEvent.type(screen.getByLabelText(/Adresse de livraison/), 'Lot II M 45');
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));

    expect(await screen.findByText(/Total à payer/)).toBeDefined();
    expect(screen.getAllByText(/5\s007,00 Ar/).length).toBeGreaterThan(0);
  });
});

describe('présentation du tunnel', () => {
  it('résume la commande à côté du formulaire, avec un lien pour modifier le panier', () => {
    definirSession('client');
    act(remplirLePanier);
    afficher();

    const resume = within(
      screen.getByRole('complementary', { name: 'Votre commande' })
    );
    expect(resume.getByText('Éclair × 2')).toBeDefined();
    expect(resume.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe(
      '/panier'
    );
    expect(screen.getByRole('heading', { name: /Mode de réception/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Vos coordonnées/ })).toBeDefined();
  });

  it('après validation, demande le paiement, puis propose de suivre ses commandes', async () => {
    vi.stubEnv('VITE_ENVIRONMENT', 'developpement');
    vi.mocked(initierPaiement).mockResolvedValue(PAIEMENT);
    vi.mocked(simulerConfirmation).mockResolvedValue({ ...PAIEMENT, statut: 'Reussi' });
    definirSession('client');
    act(remplirLePanier);
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /valider/i }));
    // Étape « Paiement » : la commande existe, il reste à la régler.
    await userEvent.type(
      await screen.findByLabelText(/numéro mobile money/i),
      '0341234567'
    );
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));
    await userEvent.click(await screen.findByRole('button', { name: /simuler/i }));

    expect(
      (await screen.findByRole('link', { name: /Suivre mes commandes/ })).getAttribute(
        'href'
      )
    ).toBe('/commandes');
    expect(screen.getByText(/commande confirmée/i)).toBeDefined();
    vi.unstubAllEnvs();
  });
});
