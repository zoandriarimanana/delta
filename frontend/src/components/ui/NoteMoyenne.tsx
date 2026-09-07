/**
 * Note moyenne — **primitive purement présentationnelle**.
 *
 * Comme `Badge`, elle ne connaît **aucune entité** du MLD : elle reçoit une
 * moyenne et un nombre d'avis, sans savoir si elle peint un produit, une
 * salle, un logement ou une formation. Passe le test de `docs/architecture.md`
 * — « ce composant resterait-il identique si on retirait toutes les entités
 * du MLD ? ».
 *
 * `moyenne` est une **chaîne ou `null`**, jamais un nombre déjà arrondi : le
 * serveur envoie un `Decimal` sérialisé en chaîne (cf. `docs/mld.md`), et
 * c'est à l'affichage — donc ici — de le convertir. `null` signifie « aucun
 * avis actif », distinct de `0`, qui serait une moyenne valide.
 */

interface Proprietes {
  moyenne: string | null;
  nombre: number;
}

const ETOILES = 5;

export default function NoteMoyenne({ moyenne, nombre }: Proprietes) {
  if (moyenne === null) {
    return <p className="text-sm text-warm-gray-500">Pas encore noté</p>;
  }

  const valeur = Number(moyenne);
  const pleines = Math.round(valeur);

  return (
    <p
      className="flex items-center gap-2 text-sm text-warm-gray-700"
      aria-label={`Note moyenne : ${valeur} sur 5, ${nombre} avis`}
    >
      <span aria-hidden="true" className="text-amber">
        {Array.from({ length: ETOILES }, (_, index) =>
          index < pleines ? '★' : '☆'
        ).join('')}
      </span>
      <span>
        {valeur.toFixed(1)} sur 5 · {nombre} avis
      </span>
    </p>
  );
}
