/**
 * Gestion de la galerie d'un bien, côté administration.
 *
 * Montée par les fiches d'administration salle, logement, formation et
 * produit, **uniquement pour un élément actif** : le serveur refuse en 404 la
 * galerie d'un élément archivé, la fiche affiche alors un message plutôt que
 * ce panneau.
 *
 * Aucun contrôle de format ni de taille n'est dupliqué ici au-delà du filtre
 * `accept` du sélecteur : c'est le serveur qui lit les octets, et son refus
 * (« JPEG, PNG et WebP », « 5 Mio ») est repris tel quel.
 */

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';

import { partieDe, urlPhoto } from '../galerie.api';
import { useGalerie, useGestionGalerie } from '../galerie.hooks';
import type { BienPhotographie } from '../galerie.types';

/** Miroir de `NOMBRE_MAX_PHOTOS` côté serveur, pour l'affichage seulement. */
const NOMBRE_MAX_PHOTOS = 10;

interface Proprietes {
  bien: BienPhotographie;
}

export default function GestionGalerie({ bien }: Proprietes) {
  const galerie = useGalerie(bien);
  const gestion = useGestionGalerie(bien, galerie.recharger);
  const [fichier, setFichier] = useState<File | null>(null);
  const selecteur = useRef<HTMLInputElement>(null);
  const pleine = galerie.photos.length >= NOMBRE_MAX_PHOTOS;

  async function envoyer() {
    if (fichier === null) return;
    if (await gestion.ajouter(fichier)) {
      setFichier(null);
      if (selecteur.current !== null) selecteur.current.value = '';
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-gris-700">Photos</h2>
        <span className="text-sm text-gris-500">
          {galerie.photos.length} / {NOMBRE_MAX_PHOTOS}
        </span>
      </div>
      <p className="mt-1 text-sm text-gris-500">
        Affichées sur la fiche publique, dans cet ordre. La première sert de couverture.
        Rangées sur le serveur dans{' '}
        <code className="text-xs">static/upload/{partieDe(bien)}/</code>.
      </p>

      {gestion.erreur !== null && (
        <p
          role="alert"
          className="mt-3 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {gestion.erreur}
        </p>
      )}

      {galerie.chargement ? (
        <p role="status" className="mt-3 text-sm text-gris-500">
          Chargement des photos…
        </p>
      ) : galerie.photos.length === 0 ? (
        <p className="mt-3 text-sm text-gris-500">
          Aucune photo pour l’instant : la fiche publique affiche une illustration.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {galerie.photos.map((photo, rang) => (
            <li
              key={photo.fichier}
              className="overflow-hidden rounded-lg border border-gris-200"
            >
              <img
                src={urlPhoto(bien, photo.fichier)}
                alt={`Photo ${rang + 1}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-gris-600">
                  {photo.fichier}
                  {rang === 0 && ' · couverture'}
                </span>
                <button
                  type="button"
                  disabled={gestion.envoi}
                  onClick={() => void gestion.retirer(photo.fichier)}
                  aria-label={`Retirer la photo ${rang + 1}`}
                  className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-40"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pleine ? (
        <p className="mt-4 text-sm text-gris-500">
          La galerie est complète. Retirez une photo pour en ajouter une autre.
        </p>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(evenement) => {
            evenement.preventDefault();
            void envoyer();
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-gris-700">
            <span>Image (JPEG, PNG ou WebP, 5 Mio max.)</span>
            <input
              ref={selecteur}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </label>
          <Bouton
            type="submit"
            disabled={fichier === null || gestion.envoi}
            className="inline-flex items-center justify-center gap-2"
          >
            <ImagePlus size={16} aria-hidden />
            {gestion.envoi ? 'Envoi…' : 'Ajouter la photo'}
          </Bouton>
        </form>
      )}
    </section>
  );
}
