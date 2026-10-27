/**
 * Rendu des états de chargement et d'erreur, partagé par les pages du module.
 *
 * Sans ce composant, chaque page réécrirait ces deux cas — et l'une d'elles
 * finirait par les oublier, laissant une page blanche sur une erreur d'API.
 */

import { useTextes } from '@/lib/langue';

import { TEXTES_PRODUIT } from '../produit.textes';

interface Proprietes {
  chargement: boolean;
  erreur: string | null;
  /** Affiché quand la requête a réussi mais n'a rien retourné. */
  messageVide?: string;
  estVide?: boolean;
  children: React.ReactNode;
}

export default function EtatRequete({
  chargement,
  erreur,
  messageVide,
  estVide = false,
  children,
}: Proprietes) {
  const t = useTextes(TEXTES_PRODUIT);
  if (chargement) {
    return (
      <p role="status" className="text-gris-500">
        {t.chargement}
      </p>
    );
  }

  if (erreur !== null) {
    return (
      <p
        role="alert"
        className="rounded border border-danger/30 bg-danger/10 p-4 text-danger"
      >
        {erreur}
      </p>
    );
  }

  if (estVide && messageVide !== undefined) {
    return <p className="text-gris-500">{messageVide}</p>;
  }

  return <>{children}</>;
}
