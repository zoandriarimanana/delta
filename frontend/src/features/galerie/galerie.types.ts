/**
 * Types du module galerie (`PHOTO_BIEN`), relevés du schéma OpenAPI.
 *
 * Une photo n'arrive **jamais avec ses octets** : la liste ne porte que
 * l'identifiant et la légende, l'image se lit à son URL propre — voir
 * `urlPhoto`.
 */

export interface PhotoBien {
  id_photo: number;
  legende: string | null;
}

/**
 * Le bien dont on affiche ou gère la galerie : une salle **ou** un logement,
 * jamais les deux — le serveur le garantit par `CHECK cible_xor`, le type le
 * rend inexprimable ici.
 */
export type BienPhotographie = { salle: number } | { logement: number };
