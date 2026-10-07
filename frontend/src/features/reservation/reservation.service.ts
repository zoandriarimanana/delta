/**
 * Règles d'affichage des réservations — fonctions pures, sans appel ni rendu.
 */

import type { VarianteBadge } from '@/components/ui/Badge';
import { imagePour } from '@/lib/images';

import type {
  Reservation,
  StatutReservation,
  TypeReservation,
} from './reservation.types';

const LIBELLES: Record<StatutReservation, string> = {
  En_attente: 'En attente de confirmation',
  Confirmee: 'Confirmée',
  // Volontairement neutre : depuis le sprint 5, une réservation honorée peut
  // être une formation suivie comme une salle occupée. « Formation suivie »
  // aurait menti sur trois types de réservation sur quatre.
  Honoree: 'Honorée',
  Annulee: 'Annulée',
};

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur un identifiant technique brut.
 *
 * Le `type` est facultatif et ne sert qu'à une précision : seule une
 * réservation de formation rend une place à sa session en s'annulant, et le
 * dire évite au client de croire sa place encore retenue. La même phrase sur
 * une salle n'aurait aucun sens — un créneau n'a pas de compteur.
 */
export function libelleStatut(
  statut: StatutReservation,
  type?: TypeReservation
): string {
  const libelle = LIBELLES[statut] ?? 'Statut indisponible';
  if (statut === 'Annulee' && type === 'Formation') {
    return `${libelle} — votre place a été libérée`;
  }
  return libelle;
}

/**
 * Nomme l'objet d'une réservation en une ligne.
 *
 * Les identifiants de cible sont **exclusifs** : le `CHECK` de `RESERVATION`
 * en autorise au plus un (cf. `docs/mld.md`). On lit donc celui qui correspond
 * au type, sans avoir à arbitrer entre deux valeurs concurrentes.
 *
 * On nomme la cible par son identifiant et non par son libellé : la charge
 * utile d'une réservation ne porte ni le nom de la salle ni le type de la
 * chambre, et aller les chercher ferait une requête par ligne affichée — la
 * dette N+1 déjà relevée sur l'historique des commandes.
 */
export function libelleCible(reservation: Reservation): string {
  switch (reservation.type_reservation) {
    case 'Formation':
      return reservation.id_session === null
        ? 'Formation'
        : `Session de formation n° ${reservation.id_session}`;
    case 'Salle':
      return reservation.id_salle === null
        ? 'Salle'
        : `Salle n° ${reservation.id_salle}`;
    case 'Logement':
      return reservation.id_logement === null
        ? 'Hébergement'
        : `Hébergement n° ${reservation.id_logement}`;
    default:
      // `Table` ne porte aucune cible : c'est prévu par le `CHECK`, pas une
      // donnée manquante (cf. `docs/mld.md`).
      return 'Table';
  }
}

/**
 * Vignette d'ambiance de la cible — décorative, jamais une vraie photo (cf.
 * `lib/images.ts`). `null` pour `Table`, qui n'a pas de cible physique : le
 * MLD ne modélise délibérément aucune entité `TABLE`, inventer une image
 * irait contre cette décision déjà actée (cf. `docs/mld.md`).
 *
 * Utilise `id_session`, pas `id_formation`, pour la formation : `Reservation`
 * ne porte que le premier, et aller chercher le second ferait une requête
 * par ligne affichée — la dette N+1 déjà relevée sur l'historique des
 * commandes (`docs/roadmap.md`). L'image restant décorative, n'importe quel
 * identifiant stable convient tout autant que `id_formation`.
 */
export function imageCible(reservation: Reservation): string | null {
  switch (reservation.type_reservation) {
    case 'Formation':
      return reservation.id_session === null
        ? null
        : imagePour('formation', reservation.id_session);
    case 'Salle':
      return reservation.id_salle === null
        ? null
        : imagePour('salle', reservation.id_salle);
    case 'Logement':
      return reservation.id_logement === null
        ? null
        : imagePour('logement', reservation.id_logement);
    default:
      return null;
  }
}

/**
 * Une réservation annulée est un état terminal : aucune des deux actions
 * d'administration ne s'applique (le serveur les refuserait en 409). Honorée
 * peut encore être annulée — seule sa propre transition redondante n'a plus
 * de sens.
 *
 * **Point unique de cette règle** : `AdministrationReservationsPage.tsx`
 * (tableau, actions en ligne) et `ReservationDetailAdministrationPage.tsx`
 * (fiche) partagent ces deux fonctions plutôt que de recalculer chacune sa
 * propre condition — même raisonnement que
 * `PersonnelService.obtenir_avec_fonction` côté serveur : deux implémentations
 * ne divergeraient qu'au jour où l'une serait corrigée sans l'autre.
 */
export function peutMarquerHonoree(reservation: Reservation): boolean {
  return reservation.statut !== 'Honoree' && reservation.statut !== 'Annulee';
}

/** Voir `peutMarquerHonoree` — même règle, même raison d'être partagée. */
export function peutAnnuler(reservation: Reservation): boolean {
  return reservation.statut !== 'Annulee';
}

/** Rubrique de « Mes réservations » où ranger une réservation. */
export type Periode = 'a_venir' | 'passee' | 'annulee';

/**
 * À venir tant qu'elle n'est ni annulée, ni honorée, ni terminée ; passée
 * sinon. `maintenant` est un paramètre pour que la règle reste testable.
 */
export function periodeReservation(
  reservation: Reservation,
  maintenant: Date
): Periode {
  if (reservation.statut === 'Annulee') return 'annulee';
  if (reservation.statut === 'Honoree') return 'passee';
  return new Date(reservation.date_fin) < maintenant ? 'passee' : 'a_venir';
}

/**
 * Le client peut-il annuler lui-même ? Seulement une réservation à venir et
 * pas encore commencée : une fois le créneau entamé, l'annulation relève de
 * l'équipe. Le serveur reste juge (409 si déjà annulée).
 */
export function peutAnnulerClient(reservation: Reservation, maintenant: Date): boolean {
  return (
    periodeReservation(reservation, maintenant) === 'a_venir' &&
    new Date(reservation.date_debut) > maintenant
  );
}

const VARIANTES: Record<StatutReservation, VarianteBadge> = {
  En_attente: 'attente',
  // Confirmée : acquise mais pas encore accomplie (bleu) ; honorée : faite (vert).
  Confirmee: 'info',
  Honoree: 'positif',
  Annulee: 'negatif',
};

/** Variante de pastille du statut — choisie ici, jamais par `Badge`. */
export function varianteStatut(statut: StatutReservation): VarianteBadge {
  return VARIANTES[statut] ?? 'neutre';
}

const TYPES: Record<TypeReservation, string> = {
  Formation: 'Formation',
  Salle: 'Salle',
  Logement: 'Hébergement',
  Table: 'Table',
};

/** Libellé court du type, pour une pastille. */
export function libelleType(type: TypeReservation): string {
  return TYPES[type] ?? type;
}
