/**
 * Règles de l'assistant IA côté frontend — fonctions pures, sans état ni
 * appel réseau, testables isolément.
 */

import type { EvenementFlux, SourceAssistant } from './assistant.types';

/** Miroir de `LONGUEUR_MAX_QUESTION` (backend) : refuser avant d'envoyer. */
export const LONGUEUR_MAX_QUESTION = 500;

const MESSAGE_GENERIQUE = 'L’assistant n’a pas pu répondre. Réessayez dans un instant.';

/**
 * Sépare d'un tampon les événements SSE complets et ce qui reste à recevoir.
 *
 * Un morceau reçu du réseau peut couper un événement en deux : seul ce qui
 * se termine par une ligne vide (`\n\n`) est interprété, le reste attend le
 * morceau suivant. Une ligne `data:` illisible est ignorée plutôt que de
 * casser toute la réponse.
 */
export function extraireEvenements(tampon: string): {
  evenements: EvenementFlux[];
  reste: string;
} {
  const blocs = tampon.split('\n\n');
  const reste = blocs.pop() ?? '';
  const evenements: EvenementFlux[] = [];
  for (const bloc of blocs) {
    for (const ligne of bloc.split('\n')) {
      if (!ligne.startsWith('data:')) {
        continue;
      }
      try {
        evenements.push(
          JSON.parse(ligne.slice('data:'.length).trim()) as EvenementFlux
        );
      } catch {
        // Événement corrompu : on l'ignore, la suite du flux reste lisible.
      }
    }
  }
  return { evenements, reste };
}

const ROUTES_PAR_TYPE: Record<string, (id: number) => string> = {
  produit: (id) => `/produits/${id}`,
  formation: (id) => `/formations/${id}`,
  salle: (id) => `/salles/${id}`,
  logement: (id) => `/logements/${id}`,
  // Les listes ne lisent pas de filtre dans l'URL : on renvoie au catalogue.
  categorie_produit: () => '/produits',
  domaine_formation: () => '/formations',
};

/** Page du site vers laquelle renvoie une source, ou `null` si type inconnu. */
export function lienSource(source: SourceAssistant): string | null {
  const route = ROUTES_PAR_TYPE[source.type_contenu];
  return route === undefined ? null : route(source.id_contenu);
}

const LIBELLES_PAR_TYPE: Record<string, string> = {
  produit: 'Produit',
  categorie_produit: 'Catégorie',
  formation: 'Formation',
  domaine_formation: 'Domaine de formation',
  salle: 'Salle',
  logement: 'Hébergement',
  guide: 'Guide de la plateforme',
  document: 'Document',
};

/** Libellé lisible d'un type de contenu — l'identifiant brut en dernier recours. */
export function libelleType(typeContenu: string): string {
  return LIBELLES_PAR_TYPE[typeContenu] ?? typeContenu;
}

/** Texte du lien d'une source : son titre, ou à défaut son type. */
export function libelleSource(source: SourceAssistant): string {
  return source.titre ?? libelleType(source.type_contenu);
}

/** Erreur HTTP de l'assistant, porteuse du code et du message du serveur. */
export class ErreurAssistant extends Error {
  readonly statut: number;

  constructor(statut: number, message: string) {
    super(message);
    this.name = 'ErreurAssistant';
    this.statut = statut;
  }
}

/**
 * Message à montrer au visiteur pour un refus du serveur.
 *
 * Le **503** est repris tel quel : il dit déjà, en français, que l'assistant
 * est momentanément indisponible. Le **429** et le **422** sont reformulés —
 * le texte brut de la limite de débit ou d'une validation n'est pas écrit
 * pour un visiteur.
 */
export function messageErreur(statut: number, detail: unknown): string {
  if (statut === 401) {
    // Session expirée, ou remplacée par celle d'un autre compte. Le flux passe
    // par `fetch` et non par axios : l'intercepteur qui gère le 401 ailleurs
    // ne voit pas cet appel, le message doit donc dire quoi faire.
    return 'Votre session n’est plus valide : reconnectez-vous pour continuer.';
  }
  if (statut === 429) {
    return 'Vous avez posé beaucoup de questions d’un coup. Patientez une minute avant de continuer.';
  }
  if (statut === 422) {
    return `Votre question est vide ou trop longue (${LONGUEUR_MAX_QUESTION} caractères au maximum).`;
  }
  if (statut === 503 && typeof detail === 'string' && detail.length > 0) {
    return detail;
  }
  return MESSAGE_GENERIQUE;
}

/** Libellé d'un refus d'administration — même logique que les autres écrans. */
export function messageDAdministration(erreur: unknown): string {
  const reponse = (
    erreur as { response?: { status?: number; data?: { detail?: unknown } } } | null
  )?.response;
  if (reponse?.status === 403) {
    return 'Cette action est réservée aux administrateurs.';
  }
  const detail = reponse?.data?.detail;
  return typeof detail === 'string' && detail.length > 0
    ? detail
    : 'L’opération a échoué. Réessayez dans un instant.';
}

/** Morceau de texte, en gras ou non. */
export interface Segment {
  texte: string;
  gras: boolean;
}

/**
 * Découpe une réponse sur les marqueurs `**gras**` du LLM.
 *
 * Le modèle écrit du Markdown léger : sans ce traitement, le visiteur verrait
 * les astérisques. Seul le gras est interprété — une bibliothèque Markdown
 * complète serait disproportionnée, et laisserait passer du HTML ou des liens
 * produits par le modèle. Un `**` orphelin (réponse encore en cours) reste du
 * texte ordinaire.
 */
export function segmentsGras(texte: string): Segment[] {
  const morceaux = texte.split('**');
  if (morceaux.length % 2 === 0) {
    // Nombre impair de marqueurs : le dernier n'est pas encore refermé.
    const dernier = morceaux.pop() ?? '';
    morceaux[morceaux.length - 1] += `**${dernier}`;
  }
  return morceaux
    .map((morceau, index) => ({ texte: morceau, gras: index % 2 === 1 }))
    .filter((segment) => segment.texte.length > 0);
}
