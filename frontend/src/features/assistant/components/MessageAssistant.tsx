/**
 * Un message de la conversation : question du visiteur, ou réponse de
 * l'assistant avec ses sources.
 *
 * Les sources sont des **liens vers les fiches** : prix, stock et places ne
 * sont jamais dans la réponse (le serveur ne les indexe pas), c'est la fiche
 * qui les affiche à jour.
 */

import { Link } from 'react-router';

import { libelleSource, lienSource, segmentsGras } from '../assistant.service';
import type { MessageConversation } from '../assistant.types';

interface Proprietes {
  message: MessageConversation;
  /** Appelé au clic sur une source — la bulle s'en sert pour se refermer. */
  surNavigation?: () => void;
}

export default function MessageAssistant({ message, surNavigation }: Proprietes) {
  if (message.auteur === 'visiteur') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-burgundy px-3 py-2 text-sm text-white">
          {message.texte}
        </p>
      </div>
    );
  }

  const enAttente = message.enCours && message.texte.length === 0;
  const sources = message.sources.filter((source) => lienSource(source) !== null);

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm ${
          message.erreur
            ? 'border border-terracotta/30 bg-terracotta/10 text-terracotta'
            : 'bg-warm-gray-100 text-warm-gray-700'
        }`}
      >
        {enAttente ? (
          <span role="status" className="text-warm-gray-500">
            L’assistant réfléchit…
          </span>
        ) : (
          <p className="whitespace-pre-wrap">
            {segmentsGras(message.texte).map((segment, index) =>
              segment.gras ? (
                <strong key={index}>{segment.texte}</strong>
              ) : (
                <span key={index}>{segment.texte}</span>
              )
            )}
          </p>
        )}

        {sources.length > 0 && (
          <div className="mt-2 border-t border-warm-gray-200 pt-2">
            <p className="text-xs font-medium text-warm-gray-500">Voir la fiche :</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <li key={`${source.type_contenu}-${source.id_contenu}`}>
                  <Link
                    to={lienSource(source) ?? '/'}
                    onClick={surNavigation}
                    className="inline-block rounded-full border border-warm-gray-300 bg-white px-2.5 py-0.5 text-xs text-burgundy hover:border-burgundy"
                  >
                    {libelleSource(source)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
