/**
 * Hooks publics de l'assistant IA : disponibilité et conversation.
 *
 * Fichier distinct de `assistant.administration.ts`, qui sert l'écran
 * réservé au personnel — même séparation que `logement.hooks.ts` /
 * `logement.administration.ts`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { poserQuestionEnFlux, recupererDisponibilite } from './assistant.api';
import {
  ErreurAssistant,
  LONGUEUR_MAX_QUESTION,
  messageErreur,
} from './assistant.service';
import type { MessageConversation } from './assistant.types';

/**
 * Vrai si l'assistant est activé côté serveur ; `null` tant qu'on ne sait pas.
 *
 * En cas d'échec de la lecture, on considère l'assistant absent : mieux vaut
 * ne pas montrer la bulle qu'afficher une bulle qui ne répondra pas.
 */
export function useDisponibiliteAssistant(): boolean | null {
  const [actif, setActif] = useState<boolean | null>(null);

  useEffect(() => {
    let annule = false;
    recupererDisponibilite()
      .then((donnees) => {
        if (!annule) setActif(donnees.actif);
      })
      .catch(() => {
        if (!annule) setActif(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  return actif;
}

export interface Conversation {
  messages: MessageConversation[];
  enCours: boolean;
  envoyer: (question: string) => Promise<void>;
  reinitialiser: () => void;
}

/**
 * Conversation avec l'assistant : questions du visiteur, réponses en flux.
 *
 * **Chaque question est traitée indépendamment** côté serveur : l'historique
 * affiché n'est pas renvoyé au modèle. C'est un choix de périmètre pour ce
 * sprint, pas un oubli — le contexte de la question vient du catalogue, pas
 * de la conversation.
 *
 * Une seule réponse à la fois : `envoyer` est sans effet tant qu'une réponse
 * arrive. Le flux en cours est interrompu au démontage du composant.
 */
export function useConversation(): Conversation {
  const [messages, setMessages] = useState<MessageConversation[]>([]);
  const [enCours, setEnCours] = useState(false);
  const compteur = useRef(0);
  const annulation = useRef<AbortController | null>(null);

  useEffect(() => () => annulation.current?.abort(), []);

  const envoyer = useCallback(
    async (question: string) => {
      const texte = question.trim();
      if (texte.length === 0 || texte.length > LONGUEUR_MAX_QUESTION || enCours) {
        return;
      }

      compteur.current += 2;
      const idQuestion = compteur.current - 1;
      const idReponse = compteur.current;
      setMessages((existants) => [
        ...existants,
        {
          id: idQuestion,
          auteur: 'visiteur',
          texte,
          sources: [],
          enCours: false,
          erreur: false,
        },
        {
          id: idReponse,
          auteur: 'assistant',
          texte: '',
          sources: [],
          enCours: true,
          erreur: false,
        },
      ]);
      setEnCours(true);

      const majReponse = (maj: (message: MessageConversation) => MessageConversation) =>
        setMessages((existants) =>
          existants.map((message) =>
            message.id === idReponse ? maj(message) : message
          )
        );

      const controleur = new AbortController();
      annulation.current = controleur;
      try {
        await poserQuestionEnFlux(
          texte,
          (evenement) => {
            if ('jeton' in evenement) {
              majReponse((m) => ({ ...m, texte: m.texte + evenement.jeton }));
            } else if ('fin' in evenement) {
              majReponse((m) => ({ ...m, sources: evenement.sources, enCours: false }));
            } else {
              // Panne en cours de génération : on garde le début de réponse.
              majReponse((m) => ({
                ...m,
                texte:
                  m.texte.length > 0
                    ? `${m.texte}\n\n${evenement.erreur}`
                    : evenement.erreur,
                erreur: true,
                enCours: false,
              }));
            }
          },
          controleur.signal
        );
        majReponse((m) => ({ ...m, enCours: false }));
      } catch (erreur) {
        if (controleur.signal.aborted) {
          return;
        }
        const message =
          erreur instanceof ErreurAssistant ? erreur.message : messageErreur(0, null);
        majReponse((m) => ({ ...m, texte: message, erreur: true, enCours: false }));
      } finally {
        if (!controleur.signal.aborted) {
          setEnCours(false);
        }
      }
    },
    [enCours]
  );

  const reinitialiser = useCallback(() => {
    annulation.current?.abort();
    setMessages([]);
    setEnCours(false);
  }, []);

  return { messages, enCours, envoyer, reinitialiser };
}
