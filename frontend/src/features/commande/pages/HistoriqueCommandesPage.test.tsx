/**
 * Tests de la page d'historique.
 *
 * L'isolation entre clients est garantie côté serveur — c'est
 * `test_commande_router.py` qui la vérifie. Ce qui est testé ici, c'est que la
 * page ne l'affaiblit pas : elle n'envoie aucun identifiant de client, et
 * n'interroge l'API que lorsqu'une session est ouverte.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { definirSession, effacerSession } from '@/lib/session.store';

import { recupererHistorique } from '../commande.api';
import type { Commande } from '../commande.types';
import HistoriqueCommandesPage from './HistoriqueCommandesPage';

vi.mock('../commande.api');

function commande(surcharge: Partial<Commande> = {}): Commande {
  return {
    id_commande: 7,
    // Date fixe : un test ne doit pas dépendre du jour où il tourne.
    date_commande: '2026-07-29T09:30:00+00:00',
    reference_publique: null,
    type_commande: 'En_ligne',
    statut: 'En_attente',
    montant_total: '7000.00',
    frais_livraison: '0.00',
    id_client: 3,
    nom_invite: null,
    contact_invite: null,
    lignes: [
      {
        id_ligne: 1,
        id_produit: 1,
        nom_produit: 'Éclair',
        quantite: 2,
        prix_unitaire_applique: '3500.00',
      },
    ],
    rembourse_le: null,
    ...surcharge,
  };
}

function afficher() {
  return render(
    <MemoryRouter>
      <HistoriqueCommandesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerSession();
  vi.mocked(recupererHistorique).mockResolvedValue([commande()]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerSession();
});

describe('visiteur non connecté', () => {
  it('invite à se connecter sans appeler l’API', () => {
    // Émettre la requête donnerait un 401, qui effacerait le jeton et
    // déclencherait une redirection — un effet de bord absurde pour quelqu'un
    // qui n'était simplement pas connecté.
    afficher();

    expect(screen.getByText(/connectez-vous/i)).toBeDefined();
    expect(recupererHistorique).not.toHaveBeenCalled();
  });

  it('rappelle comment retrouver une commande passée sans compte', () => {
    // Elle n'a pas d'`id_client` : elle ne figure dans aucun historique.
    afficher();

    expect(screen.getByText(/sans compte/i)).toBeDefined();
  });
});

describe('client connecté', () => {
  beforeEach(() => definirSession('client'));

  it('affiche un état de chargement puis les commandes', async () => {
    afficher();

    expect(screen.getByRole('status')).toBeDefined();
    expect(await screen.findByText(/commande n° 7/i)).toBeDefined();
  });

  it('montre statut, montant et lignes', async () => {
    afficher();

    expect(await screen.findByText(/Éclair × 2/)).toBeDefined();
    // Ancré sur le libellé « Total » : le sous-total de l'unique ligne vaut
    // ici le même montant, et un `getByText` sur la seule somme serait ambigu.
    const total = screen.getByText('Total').nextElementSibling;
    expect(total?.textContent).toMatch(/7\s000,00 Ar/);
    // Statut traduit, jamais l'identifiant technique « En_attente ».
    expect(screen.getByText('En attente de confirmation')).toBeDefined();
    expect(screen.queryByText(/En_attente/)).toBeNull();
  });

  it('date chaque commande', async () => {
    // Un numéro de commande ne dit pas *quand* elle a été passée.
    afficher();

    const date = await screen.findByText(/juillet 2026/);
    // La valeur brute reste portée par l'attribut, pour les lecteurs d'écran.
    expect(date.getAttribute('datetime')).toBe('2026-07-29T09:30:00+00:00');
  });

  it('n’envoie aucun identifiant de client', async () => {
    // Le filtre vient du jeton. Un paramètre client ouvrirait la porte à la
    // lecture de l'historique d'autrui.
    afficher();

    await screen.findByText(/commande n° 7/i);
    expect(recupererHistorique).toHaveBeenCalledWith();
  });

  it('respecte l’ordre rendu par le serveur', async () => {
    // Le tri est fait côté API. Le refaire ici masquerait une régression.
    vi.mocked(recupererHistorique).mockResolvedValue([
      commande({ id_commande: 12 }),
      commande({ id_commande: 5 }),
    ]);

    afficher();

    const titres = await screen.findAllByRole('heading', { level: 2 });
    expect(titres.map((t) => t.textContent)).toEqual([
      'Commande n° 12',
      'Commande n° 5',
    ]);
  });

  it('annonce un historique vide', async () => {
    vi.mocked(recupererHistorique).mockResolvedValue([]);

    afficher();

    expect(await screen.findByText(/pas encore passé de commande/i)).toBeDefined();
  });

  it('affiche un message d’erreur plutôt qu’une page blanche', async () => {
    vi.mocked(recupererHistorique).mockRejectedValue(new Error('réseau'));

    afficher();

    expect(await screen.findByRole('alert')).toBeDefined();
  });

  it('ne laisse pas fuir la trace technique', async () => {
    vi.mocked(recupererHistorique).mockRejectedValue(new Error('Request failed 500'));

    afficher();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('500');
  });
});

describe('présentation en rubriques', () => {
  beforeEach(() => {
    definirSession('client');
    vi.mocked(recupererHistorique).mockResolvedValue([
      commande({ id_commande: 9, statut: 'Livree' }),
      commande({ id_commande: 8, statut: 'Annulee' }),
      commande({ id_commande: 7, statut: 'En_attente' }),
    ]);
  });

  it('range les commandes en onglets, avec leur nombre', async () => {
    afficher();

    const onglets = await screen.findByRole('tablist', {
      name: 'Rubriques de commandes',
    });
    expect(within(onglets).getByRole('tab', { name: /En cours\s*1/ })).toBeDefined();
    expect(within(onglets).getByRole('tab', { name: /Terminées\s*1/ })).toBeDefined();
    expect(within(onglets).getByRole('tab', { name: /Annulées\s*1/ })).toBeDefined();
    expect(screen.getByText(/commande n° 7/i)).toBeDefined();
    expect(screen.queryByText(/commande n° 9/i)).toBeNull();
  });

  it('ne propose le paiement qu’à une commande en attente', async () => {
    afficher();

    expect(await screen.findByText('Paiement en attente')).toBeDefined();
    await userEvent.click(screen.getByRole('tab', { name: /Terminées/ }));

    expect(screen.getByText(/commande n° 9/i)).toBeDefined();
    expect(screen.queryByText('Paiement en attente')).toBeNull();
  });

  // Le bouton d'envoi du formulaire : « Payer … avec MVola » ou « … par carte ».
  const PAYER = /^Payer .+ (avec .+|par carte)$/;

  it('ouvre le paiement à la demande, pas d’office', async () => {
    afficher();

    await screen.findByText('Paiement en attente');
    expect(screen.queryByRole('button', { name: PAYER })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Payer maintenant/ }));

    expect(screen.getByRole('button', { name: PAYER })).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer le paiement' }));
    expect(screen.queryByRole('button', { name: PAYER })).toBeNull();
  });

  it('replie le détail d’une commande terminée, dépliable à la demande', async () => {
    afficher();
    await userEvent.click(await screen.findByRole('tab', { name: /Terminées/ }));

    expect(screen.queryByText(/Éclair × 2/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Voir le détail/ }));

    expect(screen.getByText(/Éclair × 2/)).toBeDefined();
  });
});
