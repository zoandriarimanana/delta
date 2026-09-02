/**
 * Tests du formulaire de réservation d'un créneau (salle / logement).
 *
 * Deux points portent l'essentiel :
 *
 * - le **409 de chevauchement** est repris tel quel — « Cette salle est déjà
 *   réservée sur ce créneau. » dit au client quoi corriger, un message
 *   générique le laisserait deviner ;
 * - la charge utile ne porte **que** la cible correspondant au type. Les
 *   colonnes sont exclusives par `CHECK` : en envoyer deux ferait refuser la
 *   réservation par la base.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import { creerReservation } from '../reservation.api';
import type { Reservation } from '../reservation.types';
import FormulaireReservationCreneau from './FormulaireReservationCreneau';

vi.mock('../reservation.api');

const RESERVATION: Reservation = {
  id_reservation: 21,
  type_reservation: 'Salle',
  date_debut: '2026-09-01T08:00:00Z',
  date_fin: '2026-09-01T12:00:00Z',
  nombre_personnes: 8,
  statut: 'En_attente',
  avec_hebergement: false,
  id_client: 3,
  id_session: null,
  id_salle: 4,
  id_logement: null,
};

function erreurApi(status: number, detail: string) {
  return { response: { status, data: { detail } } };
}

function afficher(
  proprietes: Partial<React.ComponentProps<typeof FormulaireReservationCreneau>> = {}
) {
  return render(
    <MemoryRouter>
      <FormulaireReservationCreneau
        cible="Salle"
        idCible={4}
        capacite={12}
        {...proprietes}
      />
    </MemoryRouter>
  );
}

/** Remplit le créneau et valide. */
async function reserver() {
  await userEvent.type(screen.getByLabelText(/^début$/i), '2026-09-01T08:00');
  await userEvent.type(screen.getByLabelText(/^fin$/i), '2026-09-01T12:00');
  await userEvent.click(screen.getByRole('button', { name: /réserver/i }));
}

beforeEach(() => {
  effacerJeton();
  vi.mocked(creerReservation).mockResolvedValue(RESERVATION);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('visiteur non connecté', () => {
  it('invite à se connecter sans émettre d’appel', () => {
    // Un 401 effacerait le jeton et déclencherait une redirection — effet de
    // bord absurde pour quelqu'un qui n'était simplement pas connecté.
    afficher();

    expect(screen.getByText(/connectez-vous/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /réserver/i })).toBeNull();
    expect(creerReservation).not.toHaveBeenCalled();
  });
});

describe('logement non réservable', () => {
  beforeEach(() => enregistrerSession('jeton.de.test', 'client'));

  it('n’affiche aucun formulaire', () => {
    // Le serveur refuse en 409 un logement en maintenance ; ne pas afficher le
    // formulaire évite au client de saisir ses dates pour rien.
    afficher({ cible: 'Logement', reservable: false });

    expect(screen.queryByRole('button', { name: /réserver/i })).toBeNull();
    expect(creerReservation).not.toHaveBeenCalled();
  });
});

describe('client connecté', () => {
  beforeEach(() => enregistrerSession('jeton.de.test', 'client'));

  it('envoie la réservation de salle et confirme', async () => {
    afficher();

    await reserver();

    expect(await screen.findByRole('status')).toBeDefined();
    expect(creerReservation).toHaveBeenCalledWith(
      expect.objectContaining({ type_reservation: 'Salle', id_salle: 4 })
    );
  });

  it('n’envoie que la cible du type demandé', async () => {
    // Le `CHECK` d'exclusivité n'autorise **au plus une** colonne cible : en
    // renseigner deux ferait refuser l'insertion.
    afficher();

    await reserver();

    await waitFor(() => expect(creerReservation).toHaveBeenCalled());
    const envoye = vi.mocked(creerReservation).mock.calls[0]?.[0] ?? {};
    expect(envoye).not.toHaveProperty('id_logement');
    expect(envoye).not.toHaveProperty('id_session');
    expect(envoye).not.toHaveProperty('avec_hebergement');
  });

  it('renseigne id_logement et non id_salle pour un logement', async () => {
    afficher({ cible: 'Logement', idCible: 9 });

    await reserver();

    await waitFor(() => expect(creerReservation).toHaveBeenCalled());
    const envoye = vi.mocked(creerReservation).mock.calls[0]?.[0] ?? {};
    expect(envoye).toMatchObject({ type_reservation: 'Logement', id_logement: 9 });
    expect(envoye).not.toHaveProperty('id_salle');
  });

  it('n’envoie aucun identifiant de client ni statut', async () => {
    // Le premier vient du jeton, le second est un cycle de vie posé par le
    // serveur.
    afficher();

    await reserver();

    await waitFor(() => expect(creerReservation).toHaveBeenCalled());
    const envoye = vi.mocked(creerReservation).mock.calls[0]?.[0] ?? {};
    expect(envoye).not.toHaveProperty('id_client');
    expect(envoye).not.toHaveProperty('statut');
  });

  it('transmet des instants datés, pas l’heure locale brute', async () => {
    // `datetime-local` rend une heure sans fuseau : la transmettre telle quelle
    // laisserait le serveur l'interpréter comme UTC et décalerait le créneau.
    afficher();

    await reserver();

    await waitFor(() => expect(creerReservation).toHaveBeenCalled());
    const envoye = vi.mocked(creerReservation).mock.calls[0]?.[0];
    expect(envoye?.date_debut).toMatch(/Z$/);
    expect(new Date(envoye?.date_debut ?? '').getTime()).toBe(
      new Date('2026-09-01T08:00').getTime()
    );
  });

  it('reprend le message du 409 « créneau déjà réservé » tel quel', async () => {
    vi.mocked(creerReservation).mockRejectedValue(
      erreurApi(409, 'Cette salle est déjà réservée sur ce créneau.')
    );
    afficher();

    await reserver();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toBe('Cette salle est déjà réservée sur ce créneau.');
  });

  it('reprend le message du 422 « capacité dépassée » tel quel', async () => {
    // Il dit combien de personnes la salle accueille : c'est ce qui permet de
    // corriger le nombre demandé.
    vi.mocked(creerReservation).mockRejectedValue(
      erreurApi(422, 'Cette salle accueille 12 personne(s), 20 demandée(s).')
    );
    afficher();

    await reserver();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toContain('12 personne(s)');
  });

  it('laisse réessayer après un refus', async () => {
    vi.mocked(creerReservation).mockRejectedValue(
      erreurApi(409, 'Cette salle est déjà réservée sur ce créneau.')
    );
    afficher();

    await reserver();
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: /réserver/i })).toBeDefined();
  });

  it('ne laisse pas fuir une trace technique', async () => {
    // Une erreur de validation de schema met une **liste** dans `detail` : la
    // rendre telle quelle afficherait du JSON au client.
    vi.mocked(creerReservation).mockRejectedValue({
      response: { status: 422, data: { detail: [{ loc: ['body'], msg: 'x' }] } },
    });
    afficher();

    await reserver();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('loc');
    expect(alerte.textContent).toMatch(/réessayez/i);
  });

  it('ne laisse pas fuir un code HTTP brut', async () => {
    vi.mocked(creerReservation).mockRejectedValue(new Error('Request failed 500'));
    afficher();

    await reserver();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('500');
  });
});
