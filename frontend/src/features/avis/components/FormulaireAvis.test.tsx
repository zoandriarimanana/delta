/**
 * Tests du formulaire de dépôt d'avis.
 *
 * Trois points portent l'essentiel :
 *
 * - un visiteur non connecté n'affiche rien plutôt que d'émettre un appel qui
 *   reviendrait en 401 (même garde que `FormulaireReservationCreneau`) ;
 * - les refus 409 et 422 sont repris tels quels — « cette commande n'est pas
 *   encore Livree » dit au client quoi corriger, un message générique non ;
 * - la charge utile ne porte **que** la cible correspondant au type
 *   (`id_ligne` pour `Produit`, `id_reservation` pour `Service`).
 */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { definirSession, effacerSession } from '@/lib/session.store';

import { creerAvis } from '../avis.api';
import type { Avis } from '../avis.types';
import FormulaireAvis from './FormulaireAvis';

vi.mock('../avis.api');

const AVIS: Avis = {
  id_avis: 1,
  type_avis: 'Produit',
  note: 5,
  commentaire: null,
  date_avis: '2026-09-07T10:00:00Z',
  id_client: 3,
  id_ligne: 42,
  id_reservation: null,
};

function erreurApi(status: number, detail: string) {
  return { response: { status, data: { detail } } };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerSession();
});

describe('visiteur non connecté', () => {
  it("n'affiche rien et n'émet aucun appel", () => {
    // Un 401 effacerait le jeton et déclencherait une redirection — effet de
    // bord absurde pour quelqu'un qui n'était simplement pas connecté.
    const { container } = render(<FormulaireAvis cible="Produit" idCible={42} />);

    expect(container.firstChild).toBeNull();
    expect(creerAvis).not.toHaveBeenCalled();
  });
});

describe('client connecté', () => {
  beforeEach(() => definirSession('client'));

  it('envoie id_ligne pour une cible Produit, jamais id_reservation', async () => {
    vi.mocked(creerAvis).mockResolvedValue(AVIS);
    render(<FormulaireAvis cible="Produit" idCible={42} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect(creerAvis).toHaveBeenCalledWith(
      expect.objectContaining({ type_avis: 'Produit', id_ligne: 42 })
    );
    const donnees = vi.mocked(creerAvis).mock.calls[0]?.[0];
    expect(donnees).not.toHaveProperty('id_reservation');
  });

  it('envoie id_reservation pour une cible Service, jamais id_ligne', async () => {
    vi.mocked(creerAvis).mockResolvedValue({
      ...AVIS,
      type_avis: 'Service',
      id_ligne: null,
      id_reservation: 9,
    });
    render(<FormulaireAvis cible="Service" idCible={9} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect(creerAvis).toHaveBeenCalledWith(
      expect.objectContaining({ type_avis: 'Service', id_reservation: 9 })
    );
    const donnees = vi.mocked(creerAvis).mock.calls[0]?.[0];
    expect(donnees).not.toHaveProperty('id_ligne');
  });

  it('confirme le dépôt et masque le formulaire', async () => {
    vi.mocked(creerAvis).mockResolvedValue(AVIS);
    render(<FormulaireAvis cible="Produit" idCible={42} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect((await screen.findByRole('status')).textContent).toContain(
      'Merci, votre avis a été enregistré.'
    );
    expect(screen.queryByRole('button', { name: /déposer mon avis/i })).toBeNull();
  });

  it('reprend le message 409 tel quel — commande non terminée', async () => {
    vi.mocked(creerAvis).mockRejectedValue(
      erreurApi(
        409,
        "Cette commande n'est pas encore Livree : impossible d'y déposer un avis."
      )
    );
    render(<FormulaireAvis cible="Produit" idCible={42} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      "Cette commande n'est pas encore Livree"
    );
  });

  it('reprend le message 409 tel quel — avis déjà déposé', async () => {
    vi.mocked(creerAvis).mockRejectedValue(
      erreurApi(409, 'Un avis a déjà été déposé sur cette cible.')
    );
    render(<FormulaireAvis cible="Service" idCible={9} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Un avis a déjà été déposé sur cette cible.'
    );
  });

  it('retombe sur un message générique si le détail est une liste', async () => {
    // Une erreur de validation de schema met une **liste** dans `detail` : la
    // rendre telle quelle afficherait du JSON.
    vi.mocked(creerAvis).mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body'], msg: 'x' }] } },
    });
    render(<FormulaireAvis cible="Produit" idCible={42} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'n’a pas pu être enregistré'
    );
  });

  it('envoie null pour un commentaire vide, jamais une chaîne vide', async () => {
    vi.mocked(creerAvis).mockResolvedValue(AVIS);
    render(<FormulaireAvis cible="Produit" idCible={42} />);

    await userEvent.click(screen.getByRole('button', { name: /déposer mon avis/i }));

    expect(creerAvis).toHaveBeenCalledWith(
      expect.objectContaining({ commentaire: null })
    );
  });
});
