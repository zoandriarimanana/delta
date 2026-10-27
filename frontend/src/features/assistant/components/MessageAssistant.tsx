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
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primaire px-3 py-2 text-sm text-sur-couleur">
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
            ? 'border border-danger/30 bg-danger/10 text-danger'
            : 'bg-gris-100 text-gris-700'
        }`}
      >
        {enAttente ? (
          <span role="status" className="text-gris-500">
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
          <div className="mt-2 border-t border-gris-200 pt-2">
            <p className="text-xs font-medium text-gris-500">Voir la fiche :</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <li key={`${source.type_contenu}-${source.id_contenu}`}>
                  <Link
                    to={lienSource(source) ?? '/'}
                    onClick={surNavigation}
                    className="inline-block rounded-full border border-gris-300 bg-surface px-2.5 py-0.5 text-xs text-primaire hover:border-primaire"
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
