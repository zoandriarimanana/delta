/**
 * Structure de page transverse : en-tête, navigation, pied de page.
 *
 * Le compteur de panier et les liens conditionnés à la session sont affichés
 * ici, mais aucune règle métier n'y est écrite : les valeurs viennent de hooks
 * — `usePanier` exposé par `features/commande/`, `useEstConnecte` et
 * `useEstPersonnelConnecte` par `lib/` — que ce layout consomme sans rien
 * savoir de leur implémentation (cf. `docs/architecture.md`).
 *
 * **Une seule source d'entrées pour les deux navigations.** La version large et
 * le menu mobile rendent la *même* liste, calculée une fois : deux listes
 * parallèles divergeraient au premier lien ajouté d'un seul côté — et c'est le
 * menu mobile, moins souvent regardé, qui resterait en retard.
 */

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { usePanier } from '@/features/commande/commande.hooks';
import { effacerJeton } from '@/lib/tokenStorage';
import { useEstConnecte, useEstPersonnelConnecte } from '@/lib/useEstConnecte';

interface Lien {
  vers: string;
  libelle: string;
  exact?: boolean;
  /** Valeur affichée en pastille, masquée si nulle. Sert au compteur de panier. */
  compteur?: number;
}

const LIENS_PUBLICS: Lien[] = [
  { vers: '/', libelle: 'Accueil', exact: true },
  { vers: '/produits', libelle: 'Produits' },
  { vers: '/formations', libelle: 'Formations' },
  { vers: '/salles', libelle: 'Salles' },
  { vers: '/logements', libelle: 'Hébergements' },
];

function classeLien({ isActive }: { isActive: boolean }): string {
  const base = 'rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-terracotta text-white`
    : `${base} text-warm-gray-700 hover:bg-warm-gray-100`;
}

function classeLienMobile({ isActive }: { isActive: boolean }): string {
  const base =
    'block w-full rounded-lg px-3 py-2 text-left text-base font-medium transition-colors';
  return isActive
    ? `${base} bg-terracotta text-white`
    : `${base} text-warm-gray-700 hover:bg-warm-gray-100`;
}

export default function MainLayout() {
  // La donnée vient d'un hook exposé par `features/commande/` : le layout
  // l'affiche sans rien savoir de la façon dont le panier est tenu.
  const { nombre } = usePanier();
  // Proposer « Mes commandes » à un visiteur non connecté le mènerait à une
  // page qu'il ne peut pas utiliser.
  const connecte = useEstConnecte();
  // Un salarié connecté n'est pas un client : les pages client lui répondraient
  // 401, ce qui effacerait sa session de travail. Les deux états s'excluent —
  // il n'y a qu'un jeton, et il porte une seule population.
  const personnel = useEstPersonnelConnecte();
  // Une session est ouverte, sans préjuger de laquelle : c'est ce qui décide
  // d'offrir « Connexion » ou « Déconnexion », les deux n'ayant jamais de sens
  // en même temps.
  const session = connecte || personnel;

  const [menuOuvert, setMenuOuvert] = useState(false);
  const fermerMenu = () => setMenuOuvert(false);

  const liens: Lien[] = [
    ...LIENS_PUBLICS,
    ...(connecte
      ? [
          { vers: '/commandes', libelle: 'Mes commandes' },
          { vers: '/reservations', libelle: 'Mes réservations' },
        ]
      : []),
    ...(personnel
      ? [
          { vers: '/personnel/commandes', libelle: 'Prise de commande' },
          { vers: '/personnel/catalogue', libelle: 'Catalogue' },
        ]
      : []),
    { vers: '/panier', libelle: 'Panier', compteur: nombre },
    ...(session ? [] : [{ vers: '/connexion', libelle: 'Connexion' }]),
  ];

  function seDeconnecter() {
    effacerJeton();
    // Rechargement plutôt qu'une navigation : l'état de session est lu au
    // rendu, et rien ne le rediffuse aux composants montés. Le remplacer par un
    // magasin réactif est une amélioration à part entière, pas un préalable.
    window.location.assign('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b-2 border-warm-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <NavLink
            to="/"
            className="font-serif text-2xl font-bold text-terracotta transition-colors hover:text-burgundy"
          >
            Delta
          </NavLink>

          <nav className="hidden gap-1 md:flex">
            {liens.map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                end={lien.exact}
                className={classeLien}
              >
                {lien.libelle}
                {lien.compteur !== undefined && lien.compteur > 0 && (
                  <span
                    data-testid="compteur-panier"
                    className="ml-2 inline-block rounded-full bg-terracotta px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    {lien.compteur}
                  </span>
                )}
              </NavLink>
            ))}
            {session && (
              <button
                type="button"
                onClick={seDeconnecter}
                className="rounded-lg px-3 py-2 text-sm font-medium text-warm-gray-700 transition-colors hover:bg-warm-gray-100"
              >
                Déconnexion
              </button>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOuvert(!menuOuvert)}
            className="rounded-lg p-2 text-warm-gray-700 transition-colors hover:bg-warm-gray-100 md:hidden"
            aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOuvert}
          >
            {menuOuvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOuvert && (
          <nav className="flex flex-col gap-2 border-t border-warm-gray-200 bg-white px-4 py-4 md:hidden">
            {liens.map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                end={lien.exact}
                className={classeLienMobile}
                onClick={fermerMenu}
              >
                {lien.libelle}
                {lien.compteur !== undefined && lien.compteur > 0 && (
                  <span className="ml-2 inline-block rounded-full bg-terracotta px-2 py-0.5 text-xs font-semibold text-white">
                    {lien.compteur}
                  </span>
                )}
              </NavLink>
            ))}
            {session && (
              <button
                type="button"
                onClick={() => {
                  fermerMenu();
                  seDeconnecter();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-base font-medium text-warm-gray-700 transition-colors hover:bg-warm-gray-100"
              >
                Déconnexion
              </button>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Le routeur injecte ici la page correspondant à l'URL. */}
        <Outlet />
      </main>

      <footer className="border-t border-warm-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-warm-gray-500">
          Delta
        </div>
      </footer>
    </div>
  );
}
