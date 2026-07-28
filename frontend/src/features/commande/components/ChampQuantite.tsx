/**
 * Champ de quantité d'une ligne de panier.
 *
 * Il porte sa propre saisie plutôt que d'être piloté directement par la
 * quantité du panier. Sans ça, vider le champ pour retaper le remettrait
 * aussitôt à sa valeur précédente, et la frappe suivante s'ajouterait au lieu
 * de la remplacer — « 2 » effacé puis « 5 » tapé donnait « 25 ».
 *
 * La quantité n'est répercutée sur le panier que lorsque la saisie est un
 * entier positif. Une saisie vide est un état de transition, pas une demande de
 * suppression : celle-ci passe par le bouton dédié.
 */

import { useEffect, useState } from 'react';

import type { LignePanier } from '../commande.types';

interface Proprietes {
  ligne: LignePanier;
  onChangement: (quantite: number) => void;
}

export default function ChampQuantite({ ligne, onChangement }: Proprietes) {
  const [saisie, setSaisie] = useState(String(ligne.quantite));

  // Resynchronise si la quantité change ailleurs — bornage au stock, ou
  // modification depuis un autre onglet.
  useEffect(() => {
    setSaisie(String(ligne.quantite));
  }, [ligne.quantite]);

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Quantité pour {ligne.nom}</span>
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
        className="w-20 rounded border border-slate-300 px-2 py-1"
      />
    </label>
  );
}
