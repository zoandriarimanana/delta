/**
 * Tests de l'écran de prise de commande par le personnel.
 *
 * Quatre garanties portent l'essentiel, et aucune ne repose sur le masquage
 * d'un lien de navigation :
 *
 * - un **jeton client** n'ouvre pas l'écran ;
 * - **aucune adresse de livraison** n'est envoyée — c'est sa présence, et elle
 *   seule, qui déclencherait une `LIVRAISON` côté serveur ;
 * - le **panier persistant du client** n'est jamais touché ;
 * - **rien ne survit** d'une commande à la suivante.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lirePanier, resynchroniserPanier } from '@/features/commande/commande.panier';
import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';
import RoutePersonnel from '@/lib/RoutePersonnel';

import { creerCommandePersonnel } from '../commande.api';
import PriseDeCommandePage from './PriseDeCommandePage';

vi.mock('../commande.api');
vi.mock('@/features/produit/produit.api');

const PRODUIT = {
  id_produit: 1,
  nom: 'Éclair',
  description: null,
  prix_unitaire: '3.50',
  unite_mesure: 'piece',
  stock_disponible: 10,
  est_personnalisable: false,
  supplement_personnalisation: null,
  est_livrable: true,
  id_categorie: 1,
};

const COMMANDE = {
  id_commande: 77,
  date_commande: '2027-08-01T19:00:00Z',
  reference_publique: null,
  type_commande: 'Sur_place' as const,
  statut: 'En_attente' as const,
  montant_total: '3.50',
  id_client: 5,
  nom_invite: null,
  contact_invite: null,
  lignes: [],
};

function afficherSousGarde() {
  return render(
    <MemoryRouter initialEntries={['/personnel/commandes']}>
      <Routes>
        <Route
          path="/personnel/commandes"
          element={
            <RoutePersonnel>
              <PriseDeCommandePage />
            </RoutePersonnel>
          }
        />
        <Route path="/personnel/connexion" element={<p>connexion personnel</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function afficher() {
  return render(
    <MemoryRouter>
      <PriseDeCommandePage />
    </MemoryRouter>
  );
}

async function ajouterUnArticle() {
  await userEvent.click(await screen.findByRole('button', { name: /ajouter/i }));
}

beforeEach(async () => {
  localStorage.clear();
  effacerJeton();
  resynchroniserPanier();
  const produitApi = await import('@/features/produit/produit.api');
  vi.mocked(produitApi.recupererProduits).mockResolvedValue([PRODUIT]);
  vi.mocked(creerCommandePersonnel).mockResolvedValue(COMMANDE);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  resynchroniserPanier();
});

describe('accès', () => {
  it('refuse un jeton client', () => {
    // **Pas un masquage de lien** : la route elle-même redirige. Les clés
    // primaires de CLIENT et PERSONNEL se recouvrent — un jeton client ne doit
    // jamais ouvrir un écran personnel.
    enregistrerSession('jeton', 'client');

    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
    expect(screen.queryByRole('heading', { name: /prise de commande/i })).toBeNull();
  });

  it('refuse un visiteur non connecté', () => {
    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });

  it('ouvre l’écran pour un salarié', () => {
    // Contrôle positif : sans lui, une garde refusant tout passerait les deux
    // tests ci-dessus.
    enregistrerSession('jeton', 'personnel');

    afficherSousGarde();

    expect(screen.getByRole('heading', { name: /prise de commande/i })).toBeDefined();
  });
});

describe('saisie', () => {
  beforeEach(() => enregistrerSession('jeton', 'personnel'));

  it('envoie une commande sur place, sans adresse de livraison', async () => {
    // **C'est la présence de l'adresse, et elle seule, qui déclenche une
    // LIVRAISON.** Ne pas l'envoyer est donc la garantie qu'aucune n'est créée.
    afficher();
    await ajouterUnArticle();
    await userEvent.type(screen.getByLabelText(/numéro de réservation/i), '42');

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(creerCommandePersonnel).toHaveBeenCalled());
    const envoye = vi.mocked(creerCommandePersonnel).mock.calls[0]?.[0];
    expect(envoye).toMatchObject({ type_commande: 'Sur_place', id_reservation: 42 });
    expect(envoye).not.toHaveProperty('adresse_livraison');
  });

  it('n’envoie aucune identité de client ni de salarié', async () => {
    // Le premier est déduit de la réservation par le serveur, le second du
    // jeton. Les envoyer permettrait de commander au nom d'autrui.
    afficher();
    await ajouterUnArticle();
    await userEvent.type(screen.getByLabelText(/numéro de réservation/i), '42');

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(creerCommandePersonnel).toHaveBeenCalled());
    const envoye = vi.mocked(creerCommandePersonnel).mock.calls[0]?.[0] ?? {};
    expect(envoye).not.toHaveProperty('id_client');
    expect(envoye).not.toHaveProperty('id_personnel');
  });

  it('envoie l’identité invitée sur l’autre chemin, sans réservation', async () => {
    afficher();
    await ajouterUnArticle();
    await userEvent.click(screen.getByLabelText(/sans compte/i));
    await userEvent.type(screen.getByLabelText(/nom de l’acheteur/i), 'Jean');
    await userEvent.type(screen.getByLabelText(/téléphone ou e-mail/i), '0340000000');

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(creerCommandePersonnel).toHaveBeenCalled());
    const envoye = vi.mocked(creerCommandePersonnel).mock.calls[0]?.[0] ?? {};
    expect(envoye).toMatchObject({ nom_invite: 'Jean', contact_invite: '0340000000' });
    expect(envoye).not.toHaveProperty('id_reservation');
  });

  it('n’envoie rien tant que la saisie est incomplète', async () => {
    // Un panier vide, ou un acheteur non désigné : le serveur refuserait, et
    // laisser envoyer ferait découvrir le refus après coup.
    afficher();

    expect(screen.getByRole('button', { name: /enregistrer/i })).toHaveProperty(
      'disabled',
      true
    );
    expect(creerCommandePersonnel).not.toHaveBeenCalled();
  });
});

describe('isolation du parcours client', () => {
  beforeEach(() => enregistrerSession('jeton', 'personnel'));

  it('ne touche jamais au panier persistant du client', async () => {
    // `commande.panier.ts` est le magasin du tunnel client. Sur un poste
    // partagé, l'écraser ferait perdre au client sa sélection en cours.
    afficher();

    await ajouterUnArticle();

    expect(lirePanier()).toEqual([]);
    expect(localStorage.getItem('delta.panier')).toBeNull();
  });

  it('ne laisse rien survivre d’une commande à la suivante', async () => {
    // Un salarié qui enchaîne repart d'un écran vierge : le panier est vidé par
    // le hook, les champs de l'acheteur par la page.
    afficher();
    await ajouterUnArticle();
    await userEvent.type(screen.getByLabelText(/numéro de réservation/i), '42');
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await screen.findByRole('status');

    expect(screen.getByLabelText(/numéro de réservation/i)).toHaveProperty('value', '');
    expect(screen.getByText(/aucun article sélectionné/i)).toBeDefined();
  });
});

describe('refus du serveur', () => {
  beforeEach(() => enregistrerSession('jeton', 'personnel'));

  it('reprend le message tel quel', async () => {
    // « Stock insuffisant … » ou « Cette réservation est « En_attente » … »
    // disent au salarié quoi corriger.
    vi.mocked(creerCommandePersonnel).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cette réservation est « En_attente » : elle ne peut pas.' },
      },
    });
    afficher();
    await ajouterUnArticle();
    await userEvent.type(screen.getByLabelText(/numéro de réservation/i), '42');

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/En_attente/);
  });

  it('conserve la saisie après un refus', async () => {
    // Vider le panier sur un refus obligerait à tout ressaisir pour corriger un
    // numéro de réservation.
    vi.mocked(creerCommandePersonnel).mockRejectedValue({
      response: { status: 409, data: { detail: 'Refus.' } },
    });
    afficher();
    await ajouterUnArticle();
    await userEvent.type(screen.getByLabelText(/numéro de réservation/i), '42');

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await screen.findByRole('alert');
    expect(screen.queryByText(/aucun article sélectionné/i)).toBeNull();
  });
});
