/**
 * Règles d'affichage du catalogue — fonctions pures, sans appel ni rendu.
 */

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
