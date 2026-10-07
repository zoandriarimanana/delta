/**
 * Règles du panier : fonctions pures, sans état ni effet.
 *
 * Elles reçoivent un panier et en rendent un nouveau. La persistance et
 * l'abonnement vivent dans `commande.panier.ts`, les composants dans `pages/`.
 * Ce découpage rend ces règles testables sans rendu ni stockage.
 */

import type {
  CheminAcheteur,
  CibleAcheteur,
  Commande,
  LignePanier,
  LigneCommandeEnvoyee,
  PersonnalisationEnvoyee,
  PersonnalisationPanier,
  StatutCommande,
  TypeCommande,
} from './commande.types';
import type { Produit } from '@/features/produit/produit.types';

export const DEVISE = 'Ar';

/**
 * Statut terminal selon le type de commande — miroir de
 * `STATUT_TERMINAL` côté serveur (`app/models/commande.py`). Une commande sur
 * place se termine sur `Servie`, les deux autres types sur `Livree`.
 *
 * Dupliqué ici, et non redemandé au serveur : c'est une règle de lecture pure,
 * qui ne dépend d'aucune donnée que le frontend n'a pas déjà.
 */
const STATUT_TERMINAL: Record<TypeCommande, StatutCommande> = {
  Sur_place: 'Servie',
  En_ligne: 'Livree',
  A_emporter: 'Livree',
};

/**
 * Une commande a-t-elle atteint son statut terminal ?
 *
 * Conditionne l'affichage du bouton « Déposer un avis » dans l'historique :
 * le serveur refuserait de toute façon en 409 une commande encore
 * `En_attente`, mais découvrir le refus après avoir rempli le formulaire
 * n'apprendrait rien — même raisonnement que `estReservable` pour un
 * logement.
 */
export function estTerminee(commande: Pick<Commande, 'statut' | 'type_commande'>) {
  return commande.statut === STATUT_TERMINAL[commande.type_commande];
}

/**
 * Ajoute un produit, ou augmente sa quantité s'il est déjà au panier.
 *
 * La quantité est bornée par le stock connu : un produit épuisé n'entre pas, et
 * on ne peut pas en demander plus qu'il n'y en a. Ce n'est qu'un garde-fou
 * d'interface — le serveur reste seul juge au moment de la commande, par un
 * décrément atomique.
 */
export function ajouterAuPanier(
  panier: LignePanier[],
  produit: Produit,
  quantite = 1,
  personnalisation?: PersonnalisationPanier
): LignePanier[] {
  if (produit.stock_disponible <= 0 || quantite <= 0) {
    return panier;
  }

  const existante = panier.find((l) => l.id_produit === produit.id_produit);
  if (existante) {
    const augmente = modifierQuantite(
      panier,
      produit.id_produit,
      existante.quantite + quantite
    );
    // Une nouvelle personnalisation remplace l'ancienne : la ligne n'en porte
    // qu'une, appliquée à toute la quantité.
    return personnalisation === undefined
      ? augmente
      : definirPersonnalisation(augmente, produit.id_produit, personnalisation);
  }

  return [
    ...panier,
    {
      id_produit: produit.id_produit,
      nom: produit.nom,
      prix_unitaire: produit.prix_unitaire,
      unite_mesure: produit.unite_mesure,
      quantite: Math.min(quantite, produit.stock_disponible),
      stock_disponible: produit.stock_disponible,
      supplement_personnalisation: produit.supplement_personnalisation,
      ...(personnalisation === undefined ? {} : { personnalisation }),
    },
  ];
}

/**
 * Pose, remplace ou retire (`null`) la personnalisation d'une ligne.
 *
 * Une personnalisation vide — aucun champ renseigné — vaut un retrait : elle
 * n'aurait rien à dire à l'administrateur, et le serveur la refuserait
 * (`description_demande` est obligatoire).
 */
export function definirPersonnalisation(
  panier: LignePanier[],
  idProduit: number,
  personnalisation: PersonnalisationPanier | null
): LignePanier[] {
  const valide =
    personnalisation !== null && descriptionDemande(personnalisation) !== ''
      ? personnalisation
      : null;
  return panier.map((ligne) => {
    if (ligne.id_produit !== idProduit) return ligne;
    const copie: LignePanier = { ...ligne };
    if (valide === null) {
      delete copie.personnalisation;
    } else {
      copie.personnalisation = valide;
    }
    return copie;
  });
}

const RUBRIQUES: [keyof PersonnalisationPanier, string][] = [
  ['message', 'Message à écrire'],
  ['theme', 'Thème et couleurs'],
  ['precisions', 'Autres précisions'],
];

/**
 * Texte envoyé dans `description_demande` : une rubrique par ligne,
 * nommée, pour que l'administrateur lise la demande d'un coup d'œil. Les
 * rubriques vides sont omises ; aucune rubrique renseignée donne `''`.
 */
export function descriptionDemande(personnalisation: PersonnalisationPanier): string {
  return RUBRIQUES.map(([champ, libelle]) => [libelle, personnalisation[champ].trim()])
    .filter(([, valeur]) => valeur !== '')
    .map(([libelle, valeur]) => `${libelle} : ${valeur}`)
    .join('\n');
}

/** Charge utile envoyée au serveur — sans supplément, qu'il calcule lui-même. */
export function versPersonnalisationEnvoyee(
  personnalisation: PersonnalisationPanier
): PersonnalisationEnvoyee {
  const ingredients = personnalisation.ingredients.trim();
  return {
    description_demande: descriptionDemande(personnalisation),
    ...(ingredients === '' ? {} : { ingredients_specifiques: ingredients }),
  };
}

/** Supplément d'une ligne (par unité × quantité), 0 si elle n'est pas personnalisée. */
export function supplementLigne(ligne: LignePanier): number {
  if (ligne.personnalisation === undefined) return 0;
  return Number(ligne.supplement_personnalisation ?? 0) * ligne.quantite;
}

/**
 * Fixe la quantité d'une ligne.
 *
 * Une quantité nulle ou négative retire la ligne : c'est le geste attendu quand
 * on vide un champ de quantité, et ça évite une ligne à zéro dans le panier.
 */
export function modifierQuantite(
  panier: LignePanier[],
  idProduit: number,
  quantite: number
): LignePanier[] {
  if (quantite <= 0) {
    return retirerDuPanier(panier, idProduit);
  }
  return panier.map((ligne) =>
    ligne.id_produit === idProduit
      ? { ...ligne, quantite: Math.min(quantite, ligne.stock_disponible) }
      : ligne
  );
}

export function retirerDuPanier(
  panier: LignePanier[],
  idProduit: number
): LignePanier[] {
  return panier.filter((ligne) => ligne.id_produit !== idProduit);
}

/** Nombre d'articles, toutes lignes confondues. Alimente le compteur de la nav. */
export function nombreArticles(panier: LignePanier[]): number {
  return panier.reduce((total, ligne) => total + ligne.quantite, 0);
}

/**
 * Total du panier, **pour l'affichage seulement**.
 *
 * Le montant réellement enregistré est calculé par le serveur à partir des prix
 * du catalogue au moment de la commande. Les deux peuvent diverger si un tarif
 * change entre-temps : c'est assumé, le panier n'engage pas de prix.
 */
export function totalPanier(panier: LignePanier[]): number {
  return panier.reduce(
    (total, ligne) =>
      total + Number(ligne.prix_unitaire) * ligne.quantite + supplementLigne(ligne),
    0
  );
}

/** Met en forme un montant en Ariary. */
export function formaterMontant(valeur: number | string): string {
  const nombre = Number(valeur);
  if (Number.isNaN(nombre)) {
    return `${valeur} ${DEVISE}`;
  }
  const montant = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(nombre);
  return `${montant} ${DEVISE}`;
}

/**
 * Traduit le panier en lignes de commande.
 *
 * Ne transmet que l'identifiant et la quantité : le prix est déterminé par le
 * serveur. L'envoyer n'aurait aucun effet, le schema d'entrée ne l'expose pas.
 */
export function versLignesEnvoyees(panier: LignePanier[]): LigneCommandeEnvoyee[] {
  return panier.map((ligne) => ({
    id_produit: ligne.id_produit,
    quantite: ligne.quantite,
    ...(ligne.personnalisation === undefined
      ? {}
      : { personnalisation: versPersonnalisationEnvoyee(ligne.personnalisation) }),
  }));
}

/**
 * Met en forme une date de commande, dans le même esprit que `formaterMontant`.
 *
 * `Intl` et non un découpage manuel : c'est lui qui connaît l'ordre des
 * composants et les séparateurs du français. La date arrive en UTC et s'affiche
 * dans le fuseau du navigateur — c'est bien l'heure locale du client qui
 * l'intéresse, pas celle du serveur.
 *
 * Une valeur illisible est rendue telle quelle plutôt que sous forme d'« Invalid
 * Date » : mieux vaut une donnée brute qu'un message qui ressemble à un bogue.
 */
export function formaterDate(valeur: string): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) {
    return valeur;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Construit la cible d'acheteur envoyée, ou `null` si la saisie est incomplète.
 *
 * Fonction **pure**, et non un bout de composant : c'est elle qui garantit
 * qu'une seule des deux formes part sur le réseau — le serveur refuse les deux
 * ensemble en 422 —, et elle se teste sans monter d'interface.
 *
 * `null` signifie « saisie incomplète », ce que l'écran traduit en bouton
 * désactivé plutôt qu'en appel voué au refus.
 */
export function versCibleAcheteur(
  chemin: CheminAcheteur,
  reservation: string,
  nom: string,
  contact: string
): CibleAcheteur | null {
  if (chemin === 'reservation') {
    const identifiant = Number(reservation);
    return Number.isInteger(identifiant) && identifiant > 0
      ? { id_reservation: identifiant }
      : null;
  }
  return nom.trim() !== '' && contact.trim() !== ''
    ? { nom_invite: nom.trim(), contact_invite: contact.trim() }
    : null;
}

/** Mode de réception choisi au tunnel. */
export type ModeReception = 'livraison' | 'retrait' | 'sur_place';

/**
 * Type de commande transmis au serveur pour chaque mode.
 *
 * Seule la livraison porte une adresse : c'est elle, et non le type, qui crée
 * la `LIVRAISON` et ses frais côté serveur.
 */
export const TYPE_PAR_MODE: Record<ModeReception, TypeCommande> = {
  livraison: 'En_ligne',
  retrait: 'A_emporter',
  sur_place: 'Sur_place',
};

/** Personnalisation sans aucune saisie — point de départ des formulaires. */
export const PERSONNALISATION_VIDE: PersonnalisationPanier = {
  message: '',
  theme: '',
  precisions: '',
  ingredients: '',
};
