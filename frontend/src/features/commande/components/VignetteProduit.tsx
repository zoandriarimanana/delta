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
}

export default function VignetteProduit({
  idProduit,
  nom,
  className = '',
}: Proprietes) {
  const bien = { produit: idProduit };
  const { photos } = useGalerie(bien);
  const couverture = photos[0];
  const image =
    couverture !== undefined
      ? urlPhoto(bien, couverture.fichier)
      : imageProduit(idProduit, nom);

  return (
    <span className={`block overflow-hidden rounded-xl bg-warm-gray-200 ${className}`}>
      <img src={image} alt="" className="h-full w-full object-cover" />
    </span>
  );
}
