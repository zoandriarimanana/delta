/** Tests des règles d'affichage des réservations. */

import { describe, expect, it, vi } from 'vitest';

import { imagePour } from '@/lib/images';

import {
  imageCible,
  libelleCible,
  libelleStatut,
  peutAnnuler,
  peutMarquerHonoree,
} from './reservation.service';

vi.mock('@/lib/images', { spy: true });
import type { Reservation, StatutReservation } from './reservation.types';

function reservation(partiel: Partial<Reservation>): Reservation {
  return {
    id_reservation: 1,
    type_reservation: 'Formation',
    date_debut: '2026-09-01T00:00:00Z',
    date_fin: '2026-09-05T00:00:00Z',
    nombre_personnes: 1,
    statut: 'En_attente',
    avec_hebergement: false,
    id_client: 3,
    id_session: null,
    id_salle: null,
    id_logement: null,
    id_reservation_hebergement: null,
    ...partiel,
  };
}

describe('libelleStatut', () => {
  it('reste neutre sur Honoree, quel que soit le type', () => {
    // Depuis le sprint 5, une réservation honorée peut être une salle occupée
    // aussi bien qu'une formation suivie.
    expect(libelleStatut('Honoree', 'Salle')).toBe('Honorée');
    expect(libelleStatut('Honoree', 'Formation')).toBe('Honorée');
  });

  it('ne parle de place libérée que pour une formation', () => {
    // Seule une session porte un compteur `places_restantes` ; un créneau de
    // salle n'a rien à restituer.
    expect(libelleStatut('Annulee', 'Formation')).toMatch(/libérée/);
    expect(libelleStatut('Annulee', 'Salle')).not.toMatch(/libérée/);
    expect(libelleStatut('Annulee', 'Logement')).not.toMatch(/libérée/);
  });

  it('retombe sur un libellé neutre pour un statut inconnu', () => {
    expect(libelleStatut('Reportee' as StatutReservation)).toBe('Statut indisponible');
  });
});

describe('libelleCible', () => {
  it('nomme la cible correspondant au type', () => {
    expect(
      libelleCible(reservation({ type_reservation: 'Formation', id_session: 12 }))
    ).toMatch(/formation n° 12/i);
    expect(
      libelleCible(reservation({ type_reservation: 'Salle', id_salle: 4 }))
    ).toMatch(/salle n° 4/i);
    expect(
      libelleCible(reservation({ type_reservation: 'Logement', id_logement: 9 }))
    ).toMatch(/hébergement n° 9/i);
  });

  it('ne lit jamais la cible d’un autre type', () => {
    // Les colonnes sont exclusives par `CHECK` ; si l'API en renvoyait deux,
    // c'est le type qui tranche, pas l'ordre de lecture.
    const melange = reservation({
      type_reservation: 'Salle',
      id_salle: 4,
      id_session: 12,
    });

    expect(libelleCible(melange)).toMatch(/salle n° 4/i);
    expect(libelleCible(melange)).not.toMatch(/12/);
  });

  it('nomme une réservation de table sans cible', () => {
    // `Table` ne porte aucune cible : c'est prévu, pas une donnée manquante.
    expect(libelleCible(reservation({ type_reservation: 'Table' }))).toBe('Table');
  });
});

describe('imageCible', () => {
  it('retourne une image pour Salle, Logement et Formation', () => {
    expect(
      imageCible(reservation({ type_reservation: 'Salle', id_salle: 4 }))
    ).not.toBeNull();
    expect(
      imageCible(reservation({ type_reservation: 'Logement', id_logement: 9 }))
    ).not.toBeNull();
    expect(
      imageCible(reservation({ type_reservation: 'Formation', id_session: 12 }))
    ).not.toBeNull();
  });

  it('ne retourne jamais d’image pour Table — aucune cible physique', () => {
    // Même raisonnement que `libelleCible` : le MLD ne modélise délibérément
    // aucune entité TABLE, inventer une image irait contre cette décision.
    expect(imageCible(reservation({ type_reservation: 'Table' }))).toBeNull();
  });

  it('reste stable pour un même identifiant', () => {
    // L'image est déterministe par identifiant (cf. `lib/images.ts`) : deux
    // lectures de la même réservation doivent donner la même image.
    const cible = reservation({ type_reservation: 'Salle', id_salle: 4 });
    expect(imageCible(cible)).toBe(imageCible(cible));
  });

  it('appelle imagePour avec id_session, jamais id_formation', () => {
    // `Reservation` ne porte que `id_session` — aller chercher
    // `id_formation` ferait une requête par ligne affichée, la dette N+1
    // déjà relevée sur l'historique des commandes.
    imageCible(reservation({ type_reservation: 'Formation', id_session: 12 }));

    expect(imagePour).toHaveBeenCalledWith('formation', 12);
  });

  it('appelle imagePour avec le bon identifiant pour Salle et Logement', () => {
    imageCible(reservation({ type_reservation: 'Salle', id_salle: 4 }));
    expect(imagePour).toHaveBeenCalledWith('salle', 4);

    imageCible(reservation({ type_reservation: 'Logement', id_logement: 9 }));
    expect(imagePour).toHaveBeenCalledWith('logement', 9);
  });
});

describe('peutMarquerHonoree', () => {
  it('refuse une réservation déjà Honoree ou Annulee', () => {
    expect(peutMarquerHonoree(reservation({ statut: 'Honoree' }))).toBe(false);
    expect(peutMarquerHonoree(reservation({ statut: 'Annulee' }))).toBe(false);
  });

  it('autorise En_attente et Confirmee', () => {
    expect(peutMarquerHonoree(reservation({ statut: 'En_attente' }))).toBe(true);
    expect(peutMarquerHonoree(reservation({ statut: 'Confirmee' }))).toBe(true);
  });
});

describe('peutAnnuler', () => {
  it('refuse une réservation déjà Annulee', () => {
    expect(peutAnnuler(reservation({ statut: 'Annulee' }))).toBe(false);
  });

  it('autorise les autres statuts, Honoree compris', () => {
    // Honorée peut encore être annulée — seule sa propre transition
    // redondante (Honoree -> Honoree) n'a plus de sens.
    expect(peutAnnuler(reservation({ statut: 'Honoree' }))).toBe(true);
    expect(peutAnnuler(reservation({ statut: 'En_attente' }))).toBe(true);
    expect(peutAnnuler(reservation({ statut: 'Confirmee' }))).toBe(true);
  });
});
