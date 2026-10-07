/**
 * Champ de quantité d'une ligne de panier, avec boutons − et +.
 *
 * Il porte sa propre saisie plutôt que d'être piloté directement par la
 * quantité du panier. Sans ça, vider le champ pour retaper le remettrait
 * aussitôt à sa valeur précédente, et la frappe suivante s'ajouterait au lieu
 * de la remplacer — « 2 » effacé puis « 5 » tapé donnait « 25 ».
 *
 * La quantité n'est répercutée sur le panier que lorsque la saisie est un
 * entier positif. Une saisie vide est un état de transition, pas une demande de
 * suppression : celle-ci passe par le bouton dédié. Les boutons sont bornés à
 * 1 et au stock connu ; le serveur reste seul juge à la commande.
 */

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import type { LignePanier } from '../commande.types';

interface Proprietes {
  ligne: LignePanier;
  onChangement: (quantite: number) => void;
}

const CLASSES_PAS =
  'flex h-9 w-9 items-center justify-center text-warm-gray-600 transition-colors hover:bg-warm-gray-100 disabled:cursor-not-allowed disabled:opacity-40';

export default function ChampQuantite({ ligne, onChangement }: Proprietes) {
  const [saisie, setSaisie] = useState(String(ligne.quantite));

  // Resynchronise si la quantité change ailleurs — bornage au stock, ou
  // modification depuis un autre onglet.
  useEffect(() => {
    setSaisie(String(ligne.quantite));
  }, [ligne.quantite]);

  return (
    <div className="flex w-fit items-center overflow-hidden rounded-full border border-warm-gray-300 bg-white">
      <button
        type="button"
        onClick={() => onChangement(ligne.quantite - 1)}
        disabled={ligne.quantite <= 1}
        aria-label={`Diminuer la quantité de ${ligne.nom}`}
        className={CLASSES_PAS}
      >
        <Minus size={14} aria-hidden />
      </button>
      <input
        type="number"
        min={1}
        max={ligne.stock_disponible}
        value={saisie}
        aria-label={`Quantité pour ${ligne.nom}`}
        onChange={(evenement) => {
          const brut = evenement.target.value;
          setSaisie(brut);
          const quantite = Number(brut);
          if (brut !== '' && Number.isInteger(quantite) && quantite >= 1) {
            onChangement(quantite);
          }
        }}
        onBlur={() => setSaisie(String(ligne.quantite))}
        className="w-12 appearance-none border-x border-warm-gray-200 bg-transparent py-1.5 text-center text-sm font-semibold text-warm-gray-700 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChangement(ligne.quantite + 1)}
        disabled={ligne.quantite >= ligne.stock_disponible}
        aria-label={`Augmenter la quantité de ${ligne.nom}`}
        className={CLASSES_PAS}
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}
