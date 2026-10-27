/**
 * Règles d'affichage du catalogue — fonctions pures, sans appel ni rendu.
 */

import type { VarianteBadge } from '@/components/ui/Badge';
import { textesCourants } from '@/lib/langue';

import { TEXTES_FORMATION } from './formation.textes';
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
  const t = textesCourants(TEXTES_FORMATION);
  if (session.statut === 'Ouverte') {
    return t.complete;
  }
  return t.raisons[session.statut] ?? t.indisponible;
}

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
  const t = textesCourants(TEXTES_FORMATION);
  if (session.statut === 'Ouverte') {
    return session.places_restantes > 0 ? t.inscriptionsOuvertes : t.completeCourt;
  }
  return t.etats[session.statut] ?? t.indisponibleCourt;
}

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
  const t = textesCourants(TEXTES_FORMATION);
  if (estReservable(session)) return t.explicationOuverte;
  if (session.statut === 'Ouverte') return t.explicationComplete;
  return t.explications[session.statut] ?? t.explicationIndisponible;
}

/** Nombre de sessions encore réservables, pour la présentation de la fiche. */
export function nombreSessionsReservables(sessions: SessionFormation[]): number {
  return sessions.filter(estReservable).length;
}
