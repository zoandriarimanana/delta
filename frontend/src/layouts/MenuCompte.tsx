/**
 * Menu « Mon compte » de l'en-tête public : pages du client et déconnexion.
 *
 * Regrouper ces entrées derrière un seul bouton libère l'en-tête : une fois
 * connecté, les liens « Mes commandes » et « Mes réservations » faisaient
 * déborder la barre — logo tronqué, libellés sur deux lignes.
 *
 * Structure de page, comme `MainLayout` qui le monte : il ne connaît aucune
 * règle métier, seulement des destinations et l'action de déconnexion qu'on
 * lui passe.
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import {
  ChevronDown,
  ClipboardList,
  CalendarCheck,
  LogOut,
  UserRound,
} from 'lucide-react';

interface Proprietes {
  surDeconnexion: () => void;
}

const ENTREES = [
  { vers: '/commandes', libelle: 'Mes commandes', icone: ClipboardList },
  { vers: '/reservations', libelle: 'Mes réservations', icone: CalendarCheck },
] as const;

export default function MenuCompte({ surDeconnexion }: Proprietes) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  // Se referme au clic à l'extérieur et sur Échap, comme tout menu déroulant.
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (evenement: MouseEvent) => {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    };
    const surTouche = (evenement: globalThis.KeyboardEvent) => {
      if (evenement.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', surClic);
    window.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      window.removeEventListener('keydown', surTouche);
    };
  }, [ouvert]);

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((valeur) => !valeur)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-gris-300 px-3 py-2 text-sm font-medium text-gris-700 transition-colors hover:border-primaire hover:text-primaire"
      >
        <UserRound size={18} aria-hidden />
        Mon compte
        <ChevronDown
          size={16}
          aria-hidden
          className={`transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>

      {ouvert && (
        <div
          role="menu"
          aria-label="Mon compte"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gris-200 bg-surface py-1 shadow-lg"
        >
          {ENTREES.map(({ vers, libelle, icone: Icone }) => (
            <NavLink
              key={vers}
              to={vers}
              role="menuitem"
              onClick={() => setOuvert(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm no-underline transition-colors ${
                  isActive
                    ? 'bg-primaire/10 font-semibold text-primaire'
                    : 'text-gris-700 hover:bg-gris-100'
                }`
              }
            >
              <Icone size={16} aria-hidden />
              {libelle}
            </NavLink>
          ))}
          <div className="my-1 border-t border-gris-200" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              surDeconnexion();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gris-700 transition-colors hover:bg-gris-100"
          >
            <LogOut size={16} aria-hidden />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
