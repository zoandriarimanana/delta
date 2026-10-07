/**
 * Galerie publique d'un bien : grande photo, flèches, miniatures, plein écran.
 *
 * Montée par les fiches salle et logement, qui n'en savent rien de plus — même
 * mécanique que `FormulaireReservationCreneau`.
 *
 * **Sans photo, une illustration d'ambiance prend la place** (`repli`) : une
 * fiche ne doit jamais s'ouvrir sur un cadre vide. Elle n'est pas présentée
 * comme une photo du lieu — pas de compteur, pas de plein écran.
 */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

import { urlPhoto } from '../galerie.api';
import type { BienPhotographie, PhotoBien } from '../galerie.types';

interface Proprietes {
  /** L'élément photographié — il désigne le dossier où lire les fichiers. */
  bien: BienPhotographie;
  photos: PhotoBien[];
  /** Illustration affichée tant que le bien n'a aucune photo. */
  repli: string;
  /** Nom du bien, pour le texte alternatif des photos. */
  nomBien: string;
}

const CLASSES_FLECHE =
  'absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gris-700 shadow-md transition hover:bg-surface';

export default function GaleriePhotos({ bien, photos, repli, nomBien }: Proprietes) {
  const [index, setIndex] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  const nombre = photos.length;
  // Une photo retirée entre deux rendus ne doit pas laisser l'index dehors.
  const courant = nombre === 0 ? 0 : Math.min(index, nombre - 1);
  const photo = photos[courant];

  function aller(decalage: number) {
    setIndex((nombre + courant + decalage) % nombre);
  }

  useEffect(() => {
    if (!pleinEcran) return;
    const surTouche = (evenement: globalThis.KeyboardEvent) => {
      if (evenement.key === 'Escape') setPleinEcran(false);
      if (evenement.key === 'ArrowRight') setIndex((i) => (i + 1) % nombre);
      if (evenement.key === 'ArrowLeft') setIndex((i) => (i - 1 + nombre) % nombre);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [pleinEcran, nombre]);

  if (photo === undefined) {
    return (
      <div className="self-start overflow-hidden rounded-2xl bg-gris-200 shadow-md">
        {/* Décorative : `alt` vide, le nom du bien est lu juste à côté. */}
        <img src={repli} alt="" className="aspect-[4/3] w-full object-cover" />
      </div>
    );
  }

  const texteAlternatif = `${nomBien}, photo ${courant + 1} sur ${nombre}`;

  return (
    <div className="self-start space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-gris-200 shadow-md">
        <button
          type="button"
          onClick={() => setPleinEcran(true)}
          aria-label="Agrandir la photo"
          className="group block w-full"
        >
          <img
            src={urlPhoto(bien, photo.fichier)}
            alt={texteAlternatif}
            className="aspect-[4/3] w-full object-cover"
          />
          <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white opacity-80 transition group-hover:opacity-100">
            <Expand size={16} aria-hidden />
          </span>
        </button>
        {nombre > 1 && (
          <>
            <button
              type="button"
              onClick={() => aller(-1)}
              aria-label="Photo précédente"
              className={`${CLASSES_FLECHE} left-3`}
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => aller(1)}
              aria-label="Photo suivante"
              className={`${CLASSES_FLECHE} right-3`}
            >
              <ChevronRight size={20} aria-hidden />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
              {courant + 1} / {nombre}
            </span>
          </>
        )}
      </div>

      {nombre > 1 && (
        <ul aria-label="Miniatures" className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((miniature, rang) => (
            <li key={miniature.fichier} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(rang)}
                aria-label={`Afficher la photo ${rang + 1}`}
                aria-current={rang === courant}
                className={`block overflow-hidden rounded-lg border-2 transition ${
                  rang === courant
                    ? 'border-primaire'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={urlPhoto(bien, miniature.fichier)}
                  alt=""
                  className="h-16 w-20 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {pleinEcran && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photos de ${nomBien}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPleinEcran(false)}
        >
          <img
            src={urlPhoto(bien, photo.fichier)}
            alt={texteAlternatif}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(evenement) => evenement.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPleinEcran(false)}
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <X size={22} aria-hidden />
          </button>
          {nombre > 1 && (
            <>
              <button
                type="button"
                onClick={(evenement) => {
                  evenement.stopPropagation();
                  aller(-1);
                }}
                aria-label="Photo précédente"
                className={`${CLASSES_FLECHE} left-4`}
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                onClick={(evenement) => {
                  evenement.stopPropagation();
                  aller(1);
                }}
                aria-label="Photo suivante"
                className={`${CLASSES_FLECHE} right-4`}
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
