/**
 * Photos proposées comme modèles (14 octobre 2026) : les exemples de
 * réalisations d'une catégorie, ou la galerie d'un produit, pour que le
 * client voie — et désigne — ce qu'il veut commander.
 *
 * Deux usages, un seul rendu :
 * - **consultation** (catalogue filtré, fiche produit) : un clic agrandit ;
 * - **choix** (`surChoix` fourni, personnalisation) : un clic désigne le
 *   modèle voulu — « Je veux ce modèle » —, un second le retire.
 *
 * Rien ne s'affiche tant que la catégorie n'a aucune photo : un bloc vide
 * n'apprendrait rien au client.
 */

import { useState } from 'react';
import { Check, X } from 'lucide-react';

import { urlPhoto } from '../galerie.api';
import { useGalerie } from '../galerie.hooks';
import type { BienPhotographie } from '../galerie.types';

interface Proprietes {
  /** Une catégorie (ses exemples) ou un produit (sa galerie). */
  bien: BienPhotographie;
  titre: string;
  /** Fichier du modèle retenu ; mode choix seulement. */
  choix?: string;
  surChoix?: (fichier: string | undefined) => void;
  libelleChoix?: string;
}

export default function ExemplesRealisations({
  bien,
  titre,
  choix,
  surChoix,
  libelleChoix = 'Je veux ce modèle',
}: Proprietes) {
  const galerie = useGalerie(bien);
  const [agrandie, setAgrandie] = useState<string | null>(null);

  if (galerie.photos.length === 0) return null;
  const modeChoix = surChoix !== undefined;

  return (
    <section aria-label={titre} className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-gris-700">{titre}</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {galerie.photos.map(({ fichier }, rang) => {
          const retenu = choix === fichier;
          return (
            <li key={fichier} className="shrink-0">
              <button
                type="button"
                aria-pressed={modeChoix ? retenu : undefined}
                aria-label={
                  modeChoix
                    ? `${libelleChoix} (exemple ${rang + 1})`
                    : `Agrandir l’exemple ${rang + 1}`
                }
                onClick={() =>
                  modeChoix
                    ? surChoix(retenu ? undefined : fichier)
                    : setAgrandie(fichier)
                }
                className={`relative block overflow-hidden rounded-xl border-2 transition ${
                  retenu
                    ? 'border-primaire ring-2 ring-primaire/30'
                    : 'border-transparent hover:border-gris-300'
                }`}
              >
                <img
                  src={urlPhoto(bien, fichier)}
                  alt={`Exemple ${rang + 1}`}
                  loading="lazy"
                  className={`${modeChoix ? 'h-24 w-24' : 'h-32 w-44'} object-cover`}
                />
                {retenu && (
                  <span className="absolute right-1 top-1 rounded-full bg-primaire p-1 text-sur-couleur">
                    <Check size={12} aria-hidden />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {agrandie !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titre}
          onClick={() => setAgrandie(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setAgrandie(null)}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-800"
          >
            <X size={20} aria-hidden />
          </button>
          <img
            src={urlPhoto(bien, agrandie)}
            alt={titre}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </section>
  );
}
