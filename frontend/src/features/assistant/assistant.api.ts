/** Appels HTTP du module assistant — et rien d'autre. */

import { axiosClient, jetonCsrf } from '@/lib/axiosClient';

import {
  ErreurAssistant,
  extraireEvenements,
  messageErreur,
} from './assistant.service';
import type {
  DisponibiliteAssistant,
  DocumentConnaissance,
  EtatAssistant,
  EvenementFlux,
  ProfilAssistant,
  PublicCible,
  ReindexationAssistant,
} from './assistant.types';

const CHEMIN = '/assistant';
const CHEMIN_DOCUMENTS = `${CHEMIN}/administration/documents`;

/** Le profil choisit l'endpoint ; le serveur vérifie la session derrière. */
const CHEMINS_FLUX: Record<ProfilAssistant, string> = {
  client: `${CHEMIN}/question/flux`,
  personnel: `${CHEMIN}/personnel/question/flux`,
};

/** Public et gratuit : ne contacte aucun fournisseur côté serveur. */
export async function recupererDisponibilite(): Promise<DisponibiliteAssistant> {
  const reponse = await axiosClient.get<DisponibiliteAssistant>(
    `${CHEMIN}/disponibilite`
  );
  return reponse.data;
}

/**
 * Pose une question et transmet la réponse au fil de l'eau.
 *
 * **`fetch` et non axios** : dans un navigateur, axios passe par
 * `XMLHttpRequest` et ne rend la réponse qu'une fois complète — le visiteur
 * attendrait la fin de la génération. `fetch` lit le corps morceau par
 * morceau.
 *
 * En contrepartie, ce que l'instance axios fait d'office est refait ici :
 * URL de base, cookies (`credentials: 'include'`) et en-tête anti-CSRF. Le
 * jeton CSRF n'est présent que pour un client connecté — un visiteur anonyme
 * n'a pas de session à protéger, et le serveur ne l'exige pas.
 *
 * Lève `ErreurAssistant` si le serveur refuse (503, 429, 422).
 */
export async function poserQuestionEnFlux(
  question: string,
  surEvenement: (evenement: EvenementFlux) => void,
  signal?: AbortSignal,
  profil: ProfilAssistant = 'client'
): Promise<void> {
  const enTetes: Record<string, string> = { 'Content-Type': 'application/json' };
  const csrf = jetonCsrf();
  if (csrf !== null) {
    enTetes['X-CSRF-Token'] = csrf;
  }

  const reponse = await fetch(
    `${axiosClient.defaults.baseURL ?? ''}${CHEMINS_FLUX[profil]}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: enTetes,
      body: JSON.stringify({ question }),
      signal,
    }
  );

  if (!reponse.ok || reponse.body === null) {
    let detail: unknown = null;
    try {
      detail = ((await reponse.json()) as { detail?: unknown }).detail;
    } catch {
      // Corps absent ou non JSON : le message générique suffira.
    }
    throw new ErreurAssistant(reponse.status, messageErreur(reponse.status, detail));
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) {
      break;
    }
    tampon += decodeur.decode(value, { stream: true });
    const { evenements, reste } = extraireEvenements(tampon);
    tampon = reste;
    evenements.forEach(surEvenement);
  }
  // Dernier événement, si le serveur a fermé sans ligne vide finale.
  extraireEvenements(`${tampon}\n\n`).evenements.forEach(surEvenement);
}

/** État de l'assistant et de son index — administrateurs uniquement. */
export async function recupererEtat(): Promise<EtatAssistant> {
  const reponse = await axiosClient.get<EtatAssistant>(`${CHEMIN}/administration/etat`);
  return reponse.data;
}

/** Reconstruit tout l'index — administrateurs uniquement, peut durer. */
export async function lancerReindexation(): Promise<ReindexationAssistant> {
  const reponse = await axiosClient.post<ReindexationAssistant>(
    `${CHEMIN}/administration/reindexation`
  );
  return reponse.data;
}

// --- Base de connaissances (administrateurs) ---------------------------------

export async function recupererDocuments(
  inclureArchives = false
): Promise<DocumentConnaissance[]> {
  const reponse = await axiosClient.get<DocumentConnaissance[]>(CHEMIN_DOCUMENTS, {
    params: inclureArchives ? { inclure_archives: true } : undefined,
  });
  return reponse.data;
}

/**
 * Téléverse un document : formulaire multipart. L'en-tête `Content-Type` est
 * laissé au navigateur, qui seul connaît la frontière (`boundary`) du
 * formulaire — le fixer à la main casserait l'envoi.
 */
export async function televerserDocument(
  titre: string,
  publicCible: PublicCible,
  fichier: File
): Promise<DocumentConnaissance> {
  const formulaire = new FormData();
  formulaire.append('titre', titre);
  formulaire.append('public_cible', publicCible);
  formulaire.append('fichier', fichier);
  const reponse = await axiosClient.post<DocumentConnaissance>(
    CHEMIN_DOCUMENTS,
    formulaire,
    {
      headers: { 'Content-Type': undefined },
    }
  );
  return reponse.data;
}

export async function archiverDocument(idDocument: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_DOCUMENTS}/${idDocument}`);
}

export async function restaurerDocument(
  idDocument: number
): Promise<DocumentConnaissance> {
  const reponse = await axiosClient.post<DocumentConnaissance>(
    `${CHEMIN_DOCUMENTS}/${idDocument}/restauration`
  );
  return reponse.data;
}
