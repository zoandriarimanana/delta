/**
 * Règles d'affichage du catalogue — fonctions pures, sans appel ni rendu.
 */

import type { VarianteBadge } from '@/components/ui/Badge';

import type { FormateurPublic, SessionFormation } from './formation.types';

/**
 * Indique si une session accepte encore des réservations.
 *
 * Deux conditions, et il faut les deux : la session doit être `Ouverte` **et**
 * avoir des places. Une session complète reste visible — le client doit pouvoir
 * constater qu'elle existe et attendre la suivante — mais elle n'est pas
 * réservable.
 *
 * Le serveur applique exactement les mêmes règles et refuse en 409 : ceci évite
 * un aller-retour inutile, ce n'est pas la garantie.
 */
export function estReservable(session: SessionFormation): boolean {
  return session.statut === 'Ouverte' && session.places_restantes > 0;
}

/** Ce qu'il faut dire au client d'une session qu'il ne peut pas réserver. */
export function raisonIndisponible(session: SessionFormation): string | null {
  if (estReservable(session)) {
    return null;
  }
  if (session.statut === 'Ouverte') {
    return 'Session complète.';
  }
  return LIBELLES_STATUT[session.statut] ?? 'Session indisponible.';
}

const LIBELLES_STATUT: Record<string, string> = {
  Planifiee: 'Inscriptions pas encore ouvertes.',
  Terminee: 'Session terminée.',
  Annulee: 'Session annulée.',
};

/**
 * Met en forme le nom d'un formateur pour l'affichage.
 *
 * Ne touche **que** `nom`, `prenom` et `specialite` : ce sont les seuls champs
 * que le type porte. Aucune coordonnée professionnelle ne peut passer par ici.
 */
export function nomFormateur(formateur: FormateurPublic): string {
  return `${formateur.prenom} ${formateur.nom}`;
}

/** Durée d'une formation, en heures, lisible. */
export function formaterDuree(heures: number): string {
  return `${heures} h`;
}

/**
 * Libellé court de l'état d'une session, pour une pastille.
 *
 * « Complète » n'est **pas** un statut du domaine (cf. `docs/mld.md`) : il se
 * lit sur `places_restantes = 0` d'une session `Ouverte`, et c'est ici, à
 * l'affichage seulement, que les deux faits se combinent.
 */
export function libelleEtatSession(session: SessionFormation): string {
  if (session.statut === 'Ouverte') {
    return session.places_restantes > 0 ? 'Inscriptions ouvertes' : 'Complète';
  }
  return ETATS[session.statut] ?? 'Indisponible';
}

const ETATS: Record<string, string> = {
  Planifiee: 'Bientôt ouverte',
  Terminee: 'Terminée',
  Annulee: 'Annulée',
};

/** Variante visuelle de l'état, choisie par le module — jamais par `Badge`. */
export function varianteEtatSession(session: SessionFormation): VarianteBadge {
  if (estReservable(session)) return 'positif';
  if (session.statut === 'Planifiee') return 'attente';
  if (session.statut === 'Ouverte') return 'negatif';
  return 'neutre';
}

/**
 * Explication détaillée de l'état d'une session : ce que le visiteur peut
 * faire, et ce qui l'attend.
 */
export function explicationSession(session: SessionFormation): string {
  if (estReservable(session)) {
    return (
      'Les inscriptions sont ouvertes. Indiquez le nombre de participants ' +
      'ci-dessous : votre place est retenue dès l’envoi de la demande, et ' +
      'apparaît aussitôt dans « Mes réservations ».'
    );
  }
  if (session.statut === 'Ouverte') {
    return (
      'Toutes les places de cette session sont prises. Une place peut se ' +
      'libérer en cas d’annulation : revenez consulter cette page, ou ' +
      'choisissez une autre session.'
    );
  }
  return (
    EXPLICATIONS[session.statut] ?? 'Cette session n’est pas disponible pour le moment.'
  );
}

const EXPLICATIONS: Record<string, string> = {
  Planifiee:
    'Cette session est programmée, mais ses inscriptions ne sont pas encore ' +
    'ouvertes. Revenez prochainement pour réserver votre place.',
  Terminee:
    'Cette session a eu lieu. Si vous y avez participé, vous pouvez déposer ' +
    'un avis depuis « Mes réservations ».',
  Annulee:
    'Cette session a été annulée et n’accepte plus d’inscription. Les places ' +
    'déjà réservées ont été libérées.',
};

/** Nombre de sessions encore réservables, pour la présentation de la fiche. */
export function nombreSessionsReservables(sessions: SessionFormation[]): number {
  return sessions.filter(estReservable).length;
}
