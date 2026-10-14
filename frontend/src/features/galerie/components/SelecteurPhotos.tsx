/**
 * Choix des photos d'un élément **avant** sa création (14 octobre 2026) :
 * une salle, une chambre, une formation ou un produit naît avec au moins une
 * photo, pour que le client voie toujours une vraie image.
 *
 * Les fichiers restent dans le navigateur jusqu'à l'enregistrement : la page
 * crée l'élément, puis les envoie dans l'ordre (`televerserPhotos`). La
 * première sert de couverture. Les miniatures sont des URL locales
 * (`URL.createObjectURL`), libérées quand elles disparaissent.
 */

import { useEffect, useMemo } from 'react';
import { ImagePlus, X } from 'lucide-react';

const TYPES = 'image/jpeg,image/png,image/webp';
const MAX = 10;

interface Proprietes {
  fichiers: File[];
  surChange: (fichiers: File[]) => void;
}

export default function SelecteurPhotos({ fichiers, surChange }: Proprietes) {
  const apercus = useMemo(
    () => fichiers.map((f) => URL.createObjectURL(f)),
    [fichiers]
  );
  useEffect(() => () => apercus.forEach((url) => URL.revokeObjectURL(url)), [apercus]);

  return (
    <fieldset className="mb-4 rounded-xl border border-dashed border-gris-300 p-4">
      <legend className="px-1 text-sm font-medium text-gris-700">
        Photos <span className="text-danger">*</span>
      </legend>
      <p className="text-xs text-gris-500">
        Au moins une photo, {MAX} au plus (JPEG, PNG ou WebP, 5 Mio chacune). La
        première sert de couverture sur le site.
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {apercus.map((url, rang) => (
          <li key={url} className="relative">
            <img
              src={url}
              alt={`Photo ${rang + 1}`}
              className="h-24 w-24 rounded-lg object-cover"
            />
            {rang === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-primaire px-1.5 py-0.5 text-[10px] font-semibold text-sur-couleur">
                Couverture
              </span>
            )}
            <button
              type="button"
              aria-label={`Retirer la photo ${rang + 1}`}
              onClick={() => surChange(fichiers.filter((_, i) => i !== rang))}
              className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-sur-couleur shadow"
            >
              <X size={12} aria-hidden />
            </button>
          </li>
        ))}
        {fichiers.length < MAX && (
          <li>
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gris-300 text-xs text-gris-500 hover:border-primaire hover:text-primaire">
              <ImagePlus size={22} aria-hidden />
              Ajouter
              <input
                type="file"
                accept={TYPES}
                multiple
                className="sr-only"
                aria-label="Ajouter des photos"
                onChange={(e) => {
                  const choisis = Array.from(e.target.files ?? []);
                  surChange([...fichiers, ...choisis].slice(0, MAX));
                  e.target.value = '';
                }}
              />
            </label>
          </li>
        )}
      </ul>
    </fieldset>
  );
}
