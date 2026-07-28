/**
 * Rendu des états de chargement et d'erreur, partagé par les pages du module.
 *
 * Sans ce composant, chaque page réécrirait ces deux cas — et l'une d'elles
 * finirait par les oublier, laissant une page blanche sur une erreur d'API.
 */

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
  if (chargement) {
    return (
      <p role="status" className="text-slate-500">
        Chargement…
      </p>
    );
  }

  if (erreur !== null) {
    return (
      <p
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-4 text-red-800"
      >
        {erreur}
      </p>
    );
  }

  if (estVide && messageVide !== undefined) {
    return <p className="text-slate-500">{messageVide}</p>;
  }

  return <>{children}</>;
}
