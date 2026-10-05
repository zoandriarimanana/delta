/**
 * Conversation de l'écran d'administration : l'assistant du personnel, ou
 * l'aperçu exact de ce que voit un visiteur dans la bulle du site.
 *
 * Deux conversations distinctes, une par profil : basculer de l'une à
 * l'autre ne mélange pas leurs historiques.
 */

import { useState } from 'react';

import { useConversation } from '../assistant.hooks';
import type { ProfilAssistant } from '../assistant.types';
import FenetreConversation, {
  ACCUEIL_CLIENT,
  ACCUEIL_PERSONNEL,
} from './FenetreConversation';

const MODES: { profil: ProfilAssistant; libelle: string; description: string }[] = [
  {
    profil: 'personnel',
    libelle: 'Assistant du personnel',
    description: 'Guide du back-office, documents internes et catalogue.',
  },
  {
    profil: 'client',
    libelle: 'Aperçu côté client',
    description: 'Exactement ce que voit un visiteur dans la bulle du site.',
  },
];

export default function PanneauConversation() {
  const [profil, setProfil] = useState<ProfilAssistant>('personnel');
  const conversations = {
    personnel: useConversation('personnel'),
    client: useConversation('client'),
  };
  const mode = MODES.find((m) => m.profil === profil) ?? MODES[0]!;

  return (
    <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white">
      <div className="border-b border-warm-gray-200 p-4">
        <h2 className="text-lg font-medium text-warm-gray-700">
          Interroger l’assistant
        </h2>
        <div
          role="tablist"
          aria-label="Profil de l’assistant"
          className="mt-3 flex gap-2"
        >
          {MODES.map((m) => (
            <button
              key={m.profil}
              type="button"
              role="tab"
              aria-selected={m.profil === profil}
              onClick={() => setProfil(m.profil)}
              className={`rounded-full px-3 py-1 text-sm ${
                m.profil === profil
                  ? 'bg-burgundy text-white'
                  : 'border border-warm-gray-300 text-warm-gray-700 hover:border-burgundy'
              }`}
            >
              {m.libelle}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-warm-gray-500">{mode.description}</p>
      </div>
      <FenetreConversation
        key={profil}
        conversation={conversations[profil]}
        accueil={profil === 'personnel' ? ACCUEIL_PERSONNEL : ACCUEIL_CLIENT}
        className="h-[32rem]"
      />
    </div>
  );
}
