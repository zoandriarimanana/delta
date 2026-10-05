/** Appels HTTP du module assistant — et rien d'autre. */

import { axiosClient, jetonCsrf } from '@/lib/axiosClient';

import {
  ErreurAssistant,
  extraireEvenements,
  messageErreur,
} from './assistant.service';
import type {
  DisponibiliteAssistant,
  EtatAssistant,
  EvenementFlux,
  ReindexationAssistant,
} from './assistant.types';

const CHEMIN = '/assistant';

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
  signal?: AbortSignal
): Promise<void> {
  const enTetes: Record<string, string> = { 'Content-Type': 'application/json' };
  const csrf = jetonCsrf();
  if (csrf !== null) {
    enTetes['X-CSRF-Token'] = csrf;
  }

  const reponse = await fetch(
    `${axiosClient.defaults.baseURL ?? ''}${CHEMIN}/question/flux`,
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
