/**
 * Structure de page de l'espace personnel : sidebar + zone de contenu.
 *
 * Remplace le header horizontal de `MainLayout` pour tout ce qui vit sous
 * `personnel/*`, à l'exception de `personnel/connexion` — décision actée du
 * chantier sidebar : c'est la porte d'entrée de cet espace, pas l'espace
 * lui-même, et une sidebar n'a pas de sens avant qu'une session existe.
 *
 * **Ce layout n'affiche que ce que l'utilisateur connecté peut réellement
 * utiliser.** La section « Gestion » est **absente**, pas grisée, pour un
 * salarié qui ne porte pas `est_administrateur` — cohérent avec le fait que
 * ce champ vient du serveur pour l'affichage seulement (cf.
 * `lib/useEstConnecte.ts::useEstAdministrateur`) : masquer un lien est une
 * commodité, la vraie protection reste `get_current_personnel_administrateur`
 * côté serveur, qui répondrait 403 même si ce composant se trompait.
 *
 * Monté par une route parente unique dans `App.tsx`
 * (`<Route path="personnel" element={<RoutePersonnel><LayoutPersonnel/></RoutePersonnel>}>`),
 * qui enveloppe les 11 routes migrées via `<Outlet/>` — la garde
 * `RoutePersonnel` n'a donc plus besoin d'être répétée à chaque route.
 */

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';

import { useDeconnexion } from '@/features/auth/auth.hooks';
import { useEstAdministrateur } from '@/lib/useEstConnecte';

interface Lien {
  vers: string;
  libelle: string;
  exact?: boolean;
}

const LIENS_GENERAL: Lien[] = [
  // `exact` : sans lui, ce lien resterait actif sur
  // `/personnel/commandes/administration...`, préfixe partagé.
  { vers: '/personnel/commandes', libelle: 'Prise de commande', exact: true },
];

const LIENS_GESTION: Lien[] = [
  { vers: '/personnel/administration', libelle: 'Personnel' },
  { vers: '/personnel/reservations', libelle: 'Réservations' },
  { vers: '/personnel/commandes/administration', libelle: 'Commandes' },
  { vers: '/personnel/abonnements', libelle: 'Abonnements' },
  { vers: '/personnel/catalogue', libelle: 'Catalogue' },
  { vers: '/personnel/categories', libelle: 'Catégories' },
  { vers: '/personnel/salles', libelle: 'Salles' },
];

function classeLien({ isActive }: { isActive: boolean }): string {
  const base = 'block rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-terracotta text-white`
    : `${base} text-warm-gray-700 hover:bg-warm-gray-100`;
}

function classeEnTeteSection(): string {
  return 'px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-warm-gray-500';
}

interface ContenuSidebarProps {
  estAdministrateur: boolean;
  onNaviguer?: () => void;
}

function ContenuSidebar({ estAdministrateur, onNaviguer }: ContenuSidebarProps) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
      <p className={classeEnTeteSection()}>Général</p>
      {LIENS_GENERAL.map((lien) => (
        <NavLink
          key={lien.vers}
          to={lien.vers}
          end={lien.exact}
          className={classeLien}
          onClick={onNaviguer}
        >
          {lien.libelle}
        </NavLink>
      ))}

      {estAdministrateur && (
        <>
          <p className={classeEnTeteSection()}>Gestion</p>
          {LIENS_GESTION.map((lien) => (
            <NavLink
              key={lien.vers}
              to={lien.vers}
              end={lien.exact}
              className={classeLien}
              onClick={onNaviguer}
            >
              {lien.libelle}
            </NavLink>
          ))}
        </>
      )}
    </nav>
  );
}

export default function LayoutPersonnel() {
  const estAdministrateur = useEstAdministrateur();
  const deconnecter = useDeconnexion();
  const naviguer = useNavigate();
  const [menuOuvert, setMenuOuvert] = useState(false);

  function seDeconnecter() {
    // Même geste que `MainLayout` : le serveur efface le cookie `httpOnly`,
    // puis le magasin réactif de session est mis à jour — la navigation
    // suit sans rechargement complet.
    void deconnecter().then(() => naviguer('/'));
  }

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Sidebar fixe, visible à partir de md. */}
      <aside className="hidden w-64 flex-col border-r-2 border-warm-gray-200 bg-white md:flex">
        <NavLink
          to="/"
          className="border-b border-warm-gray-200 px-4 py-6 font-serif text-2xl font-bold text-terracotta transition-colors hover:text-burgundy"
        >
          Delta
        </NavLink>
        <ContenuSidebar estAdministrateur={estAdministrateur} />
        <div className="border-t border-warm-gray-200 p-3">
          <button
            type="button"
            onClick={seDeconnecter}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-warm-gray-700 transition-colors hover:bg-warm-gray-100"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Barre mobile : logo + bouton d'ouverture, la sidebar devenant un
            tiroir plutôt qu'une colonne fixe sous md. */}
        <header className="flex items-center justify-between border-b-2 border-warm-gray-200 bg-white px-4 py-4 md:hidden">
          <NavLink
            to="/"
            className="font-serif text-xl font-bold text-terracotta transition-colors hover:text-burgundy"
          >
            Delta
          </NavLink>
          <button
            type="button"
            onClick={() => setMenuOuvert(!menuOuvert)}
            className="rounded-lg p-2 text-warm-gray-700 transition-colors hover:bg-warm-gray-100"
            aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOuvert}
          >
            {menuOuvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {menuOuvert && (
          <nav className="flex flex-col border-b border-warm-gray-200 bg-white px-3 py-2 md:hidden">
            <ContenuSidebar
              estAdministrateur={estAdministrateur}
              onNaviguer={() => setMenuOuvert(false)}
            />
            <button
              type="button"
              onClick={() => {
                setMenuOuvert(false);
                seDeconnecter();
              }}
              className="mt-2 block w-full rounded-lg border-t border-warm-gray-200 px-3 py-2 pt-4 text-left text-sm font-medium text-warm-gray-700 transition-colors hover:bg-warm-gray-100"
            >
              Déconnexion
            </button>
          </nav>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
