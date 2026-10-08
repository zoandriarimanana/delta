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

import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';
import { bornesQuantite } from '../commande.service';
import type { LignePanier } from '../commande.types';

interface Proprietes {
  ligne: LignePanier;
  onChangement: (quantite: number) => void;
}

const CLASSES_PAS =
  'flex h-9 w-9 items-center justify-center text-gris-600 transition-colors hover:bg-gris-100 disabled:cursor-not-allowed disabled:opacity-40';

export default function ChampQuantite({ ligne, onChangement }: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const [saisie, setSaisie] = useState(String(ligne.quantite));
  const { min, max } = bornesQuantite(ligne);

  // Resynchronise si la quantité change ailleurs — bornage au stock, ou
  // modification depuis un autre onglet.
  useEffect(() => {
    setSaisie(String(ligne.quantite));
  }, [ligne.quantite]);

  return (
    <div className="flex w-fit items-center overflow-hidden rounded-full border border-gris-300 bg-surface">
      <button
        type="button"
        onClick={() => onChangement(ligne.quantite - 1)}
        disabled={ligne.quantite <= min}
        aria-label={t.diminuer(ligne.vendu_par_personne === true, ligne.nom)}
        className={CLASSES_PAS}
      >
        <Minus size={14} aria-hidden />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={saisie}
        aria-label={t.quantitePour(ligne.vendu_par_personne === true, ligne.nom)}
        onChange={(evenement) => {
          const brut = evenement.target.value;
          setSaisie(brut);
          const quantite = Number(brut);
          if (brut !== '' && Number.isInteger(quantite) && quantite >= 1) {
            onChangement(quantite);
          }
        }}
        onBlur={() => setSaisie(String(ligne.quantite))}
        className="w-12 appearance-none border-x border-gris-200 bg-transparent py-1.5 text-center text-sm font-semibold text-gris-700 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChangement(ligne.quantite + 1)}
        disabled={ligne.quantite >= max}
        aria-label={t.augmenter(ligne.vendu_par_personne === true, ligne.nom)}
        className={CLASSES_PAS}
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}
