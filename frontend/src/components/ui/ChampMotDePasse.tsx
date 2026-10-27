/**
 * Champ de mot de passe avec un bouton « œil » pour afficher ou masquer la
 * saisie.
 *
 * Primitive strictement visuelle (critère de `components/ui/`, voir
 * `docs/architecture.md`) : elle resterait identique si l'on retirait toutes
 * les entités du MLD. Elle accepte les mêmes attributs qu'un `<input>`, sauf
 * `type`, qu'elle pilote elle-même.
 *
 * Le champ est **masqué par défaut** : afficher un mot de passe est un geste
 * volontaire, jamais l'état initial — quelqu'un peut regarder l'écran.
 *
 * Placé dans un `<label>`, le champ reste le contrôle étiqueté : il vient
 * avant le bouton dans l'ordre du document, et c'est le premier élément
 * étiquetable qui reçoit le libellé.
 */

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { useTextes } from '@/lib/langue';

import { TEXTES_UI } from './ui.textes';

type Proprietes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function ChampMotDePasse({ className = '', ...reste }: Proprietes) {
  const t = useTextes(TEXTES_UI);
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative flex">
      <input
        {...reste}
        type={visible ? 'text' : 'password'}
        className={`w-full pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((valeur) => !valeur)}
        // Nom accessible sans « mot de passe » : sinon une recherche du champ
        // par son libellé (`getByLabelText(/mot de passe/i)`, ou un lecteur
        // d'écran qui liste les champs) trouverait aussi ce bouton. L'infobulle,
        // elle, reste explicite.
        aria-label={visible ? t.masquerSaisie : t.afficherSaisie}
        aria-pressed={visible}
        title={visible ? t.masquerMotDePasse : t.afficherMotDePasse}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gris-500 hover:text-gris-700"
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </span>
  );
}
