/**
 * Fenêtre de conversation : messages, suggestions de départ, zone de saisie.
 *
 * **Partagée** par la bulle du site public et par l'écran d'administration :
 * une seule implémentation du rendu, pas deux qui divergeraient — l'état vient
 * de `useConversation`, passé par l'appelant.
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { RotateCcw, Send } from 'lucide-react';

import type { Conversation } from '../assistant.hooks';
import { LONGUEUR_MAX_QUESTION } from '../assistant.service';
import MessageAssistant from './MessageAssistant';

const SUGGESTIONS = [
  'Quelles formations en pâtisserie proposez-vous ?',
  'Avez-vous une salle pour une réunion de 30 personnes ?',
  'Faites-vous des gâteaux personnalisés ?',
];

interface Proprietes {
  conversation: Conversation;
  surNavigation?: () => void;
  className?: string;
}

export default function FenetreConversation({
  conversation,
  surNavigation,
  className = '',
}: Proprietes) {
  const [saisie, setSaisie] = useState('');
  const finDeListe = useRef<HTMLDivElement>(null);
  const { messages, enCours, envoyer, reinitialiser } = conversation;

  // Suit la réponse au fil des jetons. `scrollIntoView` est absent de jsdom.
  useEffect(() => {
    finDeListe.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  const trop = saisie.length > LONGUEUR_MAX_QUESTION;
  const envoyable = saisie.trim().length > 0 && !trop && !enCours;

  function soumettre(evenement?: FormEvent) {
    evenement?.preventDefault();
    if (!envoyable) return;
    void envoyer(saisie);
    setSaisie('');
  }

  function surTouche(evenement: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie, Maj+Entrée va à la ligne — l'usage des messageries.
    if (evenement.key === 'Enter' && !evenement.shiftKey) {
      evenement.preventDefault();
      soumettre();
    }
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3 text-sm text-warm-gray-600">
            <p>
              Bonjour ! Posez-moi vos questions sur nos produits, nos formations, nos
              salles ou nos hébergements.
            </p>
            <ul className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void envoyer(suggestion)}
                    className="w-full rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-left text-sm text-warm-gray-700 hover:border-burgundy"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((message) => (
            <MessageAssistant
              key={message.id}
              message={message}
              surNavigation={surNavigation}
            />
          ))
        )}
        <div ref={finDeListe} />
      </div>

      <form onSubmit={soumettre} className="border-t border-warm-gray-200 p-3">
        <label htmlFor="question-assistant" className="sr-only">
          Votre question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="question-assistant"
            rows={2}
            value={saisie}
            onChange={(evenement) => setSaisie(evenement.target.value)}
            onKeyDown={surTouche}
            placeholder="Écrivez votre question…"
            className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-warm-gray-300 px-3 py-2 text-sm focus:border-burgundy focus:outline-none"
          />
          <button
            type="submit"
            disabled={!envoyable}
            aria-label="Envoyer la question"
            className="rounded-lg bg-burgundy p-2.5 text-white transition-opacity disabled:opacity-40"
          >
            <Send size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-warm-gray-500">
          <span className={trop ? 'text-terracotta' : undefined}>
            {saisie.length}/{LONGUEUR_MAX_QUESTION}
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reinitialiser}
              className="inline-flex items-center gap-1 hover:text-warm-gray-700"
            >
              <RotateCcw size={12} aria-hidden />
              Nouvelle conversation
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] leading-tight text-warm-gray-400">
          Réponses générées par une IA à partir de notre catalogue. Prix, disponibilités
          et places : consultez la fiche concernée.
        </p>
      </form>
    </div>
  );
}
