/**
 * Bulle de discussion flottante du site public.
 *
 * Montée par `MainLayout`, qui n'en sait rien de plus : même mécanique que
 * `FormationDetailPage` montant `FormulaireReservation`. Ne s'affiche **que si
 * l'assistant est activé** côté serveur — sinon, rien du tout, plutôt qu'une
 * bulle qui répondrait « indisponible ».
 *
 * La conversation survit à la navigation : le layout, et donc la bulle, ne
 * sont pas démontés quand la page change.
 */

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

import { useConversation, useDisponibiliteAssistant } from '../assistant.hooks';
import type { ProfilAssistant } from '../assistant.types';
import FenetreConversation, {
  ACCUEIL_CLIENT,
  ACCUEIL_PERSONNEL,
} from './FenetreConversation';

const PRESENTATIONS: Record<ProfilAssistant, { titre: string; sousTitre: string }> = {
  client: {
    titre: 'Assistant Delta',
    sousTitre: 'Réponses à partir de notre catalogue',
  },
  personnel: {
    titre: 'Assistant du personnel',
    sousTitre: 'Les étapes à suivre dans l’espace personnel',
  },
};

interface Proprietes {
  /**
   * `personnel` : montée par `LayoutPersonnel`, elle interroge l'endpoint du
   * personnel — le serveur vérifie la session, ce choix ne contourne rien.
   */
  profil?: ProfilAssistant;
}

export default function BulleAssistant({ profil = 'client' }: Proprietes) {
  const actif = useDisponibiliteAssistant();
  const conversation = useConversation(profil);
  const presentation = PRESENTATIONS[profil];
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (evenement: globalThis.KeyboardEvent) => {
      if (evenement.key === 'Escape') setOuverte(false);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouverte]);

  if (actif !== true) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {ouverte && (
        <section
          id="fenetre-assistant"
          aria-label={presentation.titre}
          className="flex h-[min(34rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gris-200 bg-fond shadow-xl"
        >
          <header className="flex items-center justify-between bg-primaire px-4 py-3 text-sur-couleur">
            <div>
              <h2 className="text-sm font-semibold">{presentation.titre}</h2>
              <p className="text-xs text-sur-couleur/80">{presentation.sousTitre}</p>
            </div>
            <button
              type="button"
              onClick={() => setOuverte(false)}
              aria-label="Fermer l’assistant"
              className="rounded p-1 hover:bg-white/10"
            >
              <X size={18} aria-hidden />
            </button>
          </header>
          {/* Un clic sur une source referme la bulle : la fiche s'affiche en
              entier, sur mobile surtout. La conversation, elle, est gardée. */}
          <FenetreConversation
            conversation={conversation}
            surNavigation={() => setOuverte(false)}
            accueil={profil === 'personnel' ? ACCUEIL_PERSONNEL : ACCUEIL_CLIENT}
            className="flex-1"
          />
        </section>
      )}

      <button
        type="button"
        onClick={() => setOuverte((valeur) => !valeur)}
        aria-label={ouverte ? 'Fermer l’assistant' : 'Ouvrir l’assistant'}
        aria-expanded={ouverte}
        aria-controls="fenetre-assistant"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primaire text-sur-couleur shadow-lg transition-transform hover:scale-105"
      >
        {ouverte ? (
          <X size={24} aria-hidden />
        ) : (
          <MessageCircle size={24} aria-hidden />
        )}
      </button>
    </div>
  );
}
