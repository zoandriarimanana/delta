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

import { useTextes } from '@/lib/langue';

import { TEXTES_UI } from './ui.textes';

interface Proprietes {
  moyenne: string | null;
  nombre: number;
}

const ETOILES = 5;

export default function NoteMoyenne({ moyenne, nombre }: Proprietes) {
  const t = useTextes(TEXTES_UI);
  if (moyenne === null) {
    return <p className="text-sm text-gris-500">{t.pasEncoreNote}</p>;
  }

  const valeur = Number(moyenne);
  const pleines = Math.round(valeur);

  return (
    <p
      className="flex items-center gap-2 text-sm text-gris-700"
      aria-label={t.noteAccessible(valeur, nombre)}
    >
      <span aria-hidden="true" className="text-attente">
        {Array.from({ length: ETOILES }, (_, index) =>
          index < pleines ? '★' : '☆'
        ).join('')}
      </span>
      <span>{t.note(valeur.toFixed(1), nombre)}</span>
    </p>
  );
}
