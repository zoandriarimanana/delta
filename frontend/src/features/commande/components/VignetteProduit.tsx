/**
 * Vignette d'un produit dans le panier et le tunnel.
 *
 * La **couverture** du produit (première photo de sa galerie) ou, à défaut,
 * son illustration — la même image que sur sa fiche, pour que le client
 * reconnaisse ce qu'il a choisi.
 */

import { urlPhoto } from '@/features/galerie/galerie.api';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import { imageProduit } from '@/lib/images';

interface Proprietes {
  idProduit: number;
  nom: string;
  className?: string;
  /** Photo choisie par le client (URL complète) : elle prime sur la
   * couverture (14 octobre 2026). */
  image?: string;
}

export default function VignetteProduit({
  idProduit,
  nom,
  className = '',
  image: choisie,
}: Proprietes) {
  const bien = { produit: idProduit };
  // Inutile de lire la galerie quand la photo est déjà connue.
  const { photos } = useGalerie(choisie === undefined ? bien : null);
  const couverture = photos[0];
  const image =
    choisie ??
    (couverture !== undefined
      ? urlPhoto(bien, couverture.fichier)
      : imageProduit(idProduit, nom));

  return (
    <span className={`block overflow-hidden rounded-xl bg-gris-200 ${className}`}>
      <img src={image} alt="" className="h-full w-full object-cover" />
    </span>
  );
}
