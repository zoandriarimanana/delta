/**
 * Tests du formulaire de réservation.
 *
 * Le cœur du module est le traitement des **refus métier**. L'API renvoie deux
 * erreurs distinctes qui portent chacune ce qu'il faut pour corriger :
 *
 * - **409** « Il ne reste que N place(s)… » ;
 * - **422** « La formation « … » ne propose pas d'hébergement. »
 *
 * Les remplacer par un message générique ferait perdre exactement cela. Même
 * traitement que le « stock insuffisant » du tunnel de commande.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import { creerReservation } from '../reservation.api';
import type { Reservation } from '../reservation.types';
import FormulaireReservation from './FormulaireReservation';

vi.mock('../reservation.api');

const RESERVATION: Reservation = {
  id_reservation: 7,
  type_reservation: 'Formation',
  date_debut: '2026-09-01T00:00:00Z',
  date_fin: '2026-09-05T00:00:00Z',
  nombre_personnes: 1,
  statut: 'En_attente',
  avec_hebergement: false,
  id_client: 3,
  id_session: 12,
  id_salle: null,
  id_logement: null,
};

function erreurApi(status: number, detail: string) {
  return { response: { status, data: { detail } } };
}

function afficher(proposeHebergement = false) {
  return render(
    <MemoryRouter>
      <FormulaireReservation
        idSession={12}
        dateDebut="2026-09-01"
        dateFin="2026-09-05"
        placesRestantes={5}
        proposeHebergement={proposeHebergement}
      />
    </MemoryRouter>
  );
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

describe('client connecté', () => {
  beforeEach(() => enregistrerSession('jeton.de.test', 'client'));

  it('envoie la réservation et confirme', async () => {
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    expect(await screen.findByRole('status')).toBeDefined();
    expect(creerReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        type_reservation: 'Formation',
        id_session: 12,
        nombre_personnes: 1,
        avec_hebergement: false,
      })
    );
  });

  it('n’envoie aucun identifiant de client ni statut', async () => {
    // Le premier vient du jeton, le second est un cycle de vie posé par le
    // serveur. Les envoyer n'aurait aucun effet, mais le type ne les porte pas
    // pour que personne n'essaie.
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    await waitFor(() => expect(creerReservation).toHaveBeenCalled());
    const envoye = vi.mocked(creerReservation).mock.calls[0]?.[0] ?? {};
    expect(envoye).not.toHaveProperty('id_client');
    expect(envoye).not.toHaveProperty('statut');
  });

  it('reprend le message du 409 « session complète » tel quel', async () => {
    // « Il ne reste que 2 place(s) » dit au client quoi corriger. Un message
    // générique le laisserait deviner.
    vi.mocked(creerReservation).mockRejectedValue(
      erreurApi(409, 'Il ne reste que 2 place(s) sur cette session, 5 demandée(s).')
    );
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toContain('2 place(s)');
  });

  it('reprend le message du 422 « hébergement non proposé » tel quel', async () => {
    vi.mocked(creerReservation).mockRejectedValue(
      erreurApi(422, 'La formation « CAP Pâtissier » ne propose pas d’hébergement.')
    );
    afficher(true);

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toMatch(/ne propose pas d’hébergement/);
  });

  it('laisse réessayer après un refus', async () => {
    vi.mocked(creerReservation).mockRejectedValue(erreurApi(409, 'Session complète.'));
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));
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

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('loc');
    expect(alerte.textContent).toMatch(/réessayez/i);
  });

  it('ne laisse pas fuir un code HTTP brut', async () => {
    vi.mocked(creerReservation).mockRejectedValue(new Error('Request failed 500'));
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).not.toContain('500');
  });
});

describe('option hébergement', () => {
  beforeEach(() => enregistrerSession('jeton.de.test', 'client'));

  it('n’est pas proposée si la formation ne l’offre pas', () => {
    // Le serveur refuserait en 422 de toute façon ; ne pas l'afficher évite au
    // client de découvrir le refus après coup.
    afficher(false);

    expect(screen.queryByLabelText(/hébergé/i)).toBeNull();
  });

  it('est proposée et transmise quand la formation l’offre', async () => {
    afficher(true);

    await userEvent.click(screen.getByLabelText(/hébergé/i));
    await userEvent.click(screen.getByRole('button', { name: /réserver/i }));

    await waitFor(() =>
      expect(creerReservation).toHaveBeenCalledWith(
        expect.objectContaining({ avec_hebergement: true })
      )
    );
  });
});
