/**
 * Gestion de la galerie d'un bien, côté administration.
 *
 * Montée par les fiches d'administration salle et logement, **uniquement pour
 * un bien actif** : le serveur refuse en 404 la galerie d'un bien archivé, la
 * fiche affiche alors un message plutôt que ce panneau.
 *
 * Aucun contrôle de format ni de taille n'est dupliqué ici au-delà du filtre
 * `accept` du sélecteur : c'est le serveur qui lit les octets, et son refus
 * (« JPEG, PNG et WebP », « 5 Mio ») est repris tel quel.
 */

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';

import { urlPhoto } from '../galerie.api';
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
  const [legende, setLegende] = useState('');
  const selecteur = useRef<HTMLInputElement>(null);
  const pleine = galerie.photos.length >= NOMBRE_MAX_PHOTOS;

  async function envoyer() {
    if (fichier === null) return;
    if (await gestion.ajouter(fichier, legende)) {
      setFichier(null);
      setLegende('');
      if (selecteur.current !== null) selecteur.current.value = '';
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-warm-gray-700">Photos</h2>
        <span className="text-sm text-warm-gray-500">
          {galerie.photos.length} / {NOMBRE_MAX_PHOTOS}
        </span>
      </div>
      <p className="mt-1 text-sm text-warm-gray-500">
        Affichées sur la fiche publique, dans cet ordre. La première sert de couverture.
      </p>

      {gestion.erreur !== null && (
        <p
          role="alert"
          className="mt-3 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {gestion.erreur}
        </p>
      )}

      {galerie.chargement ? (
        <p role="status" className="mt-3 text-sm text-warm-gray-500">
          Chargement des photos…
        </p>
      ) : galerie.photos.length === 0 ? (
        <p className="mt-3 text-sm text-warm-gray-500">
          Aucune photo pour l’instant : la fiche publique affiche une illustration.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {galerie.photos.map((photo, rang) => (
            <li
              key={photo.id_photo}
              className="overflow-hidden rounded-lg border border-warm-gray-200"
            >
              <img
                src={urlPhoto(photo.id_photo)}
                alt={photo.legende ?? `Photo ${rang + 1}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-warm-gray-600">
                  {rang === 0 ? 'Couverture' : (photo.legende ?? `Photo ${rang + 1}`)}
                </span>
                <button
                  type="button"
                  disabled={gestion.envoi}
                  onClick={() => void gestion.retirer(photo.id_photo)}
                  aria-label={`Retirer la photo ${rang + 1}`}
                  className="rounded p-1 text-terracotta hover:bg-terracotta/10 disabled:opacity-40"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pleine ? (
        <p className="mt-4 text-sm text-warm-gray-500">
          La galerie est complète. Retirez une photo pour en ajouter une autre.
        </p>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(evenement) => {
            evenement.preventDefault();
            void envoyer();
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
            <span>Image (JPEG, PNG ou WebP, 5 Mio max.)</span>
            <input
              ref={selecteur}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
            <span>
              Légende <span className="text-warm-gray-500">(facultative)</span>
            </span>
            <input
              type="text"
              maxLength={200}
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              className="rounded border border-warm-gray-300 px-2 py-1"
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
