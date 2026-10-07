/**
 * Structure de page transverse : en-tête, navigation, pied de page.
 *
 * Le compteur de panier et les liens conditionnés à la session sont affichés
 * ici, mais aucune règle métier n'y est écrite : les valeurs viennent de hooks
 * — `usePanier` exposé par `features/commande/`, `useEstConnecte` par `lib/`
 * — que ce layout consomme sans rien savoir de leur implémentation (cf.
 * `docs/architecture.md`). Un salarié connecté n'atteint plus ce layout du
 * tout, `RouteClient` l'écartant avant qu'il ne soit monté — ce fichier n'a
 * donc plus besoin de connaître `useEstPersonnelConnecte`.
 *
 * **Une seule source d'entrées pour les deux navigations.** La version large et
 * le menu mobile rendent les *mêmes* listes (`LIENS_PUBLICS`, `LIENS_COMPTE`) :
 * deux listes parallèles divergeraient au premier lien ajouté d'un seul côté.
 *
 * **Sur grand écran**, les pages du compte vivent dans le menu « Mon compte »
 * et le panier est une icône : une fois connecté, huit liens à plat faisaient
 * déborder la barre (logo tronqué, libellés sur deux lignes).
 */

import { useState } from 'react';
import { Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';

import LogoDelta from '@/components/ui/LogoDelta';
import BulleAssistant from '@/features/assistant/components/BulleAssistant';
import { useDeconnexion } from '@/features/auth/auth.hooks';
import { usePanier } from '@/features/commande/commande.hooks';
import { useEstConnecte } from '@/lib/useEstConnecte';

import MenuCompte from './MenuCompte';

interface Lien {
  vers: string;
  libelle: string;
  exact?: boolean;
}

const LIENS_PUBLICS: Lien[] = [
  { vers: '/', libelle: 'Accueil', exact: true },
  { vers: '/produits', libelle: 'Produits' },
  { vers: '/formations', libelle: 'Formations' },
  { vers: '/salles', libelle: 'Salles' },
  { vers: '/logements', libelle: 'Hébergements' },
];

/** Pages du client connecté — dans « Mon compte » sur grand écran, à plat sur mobile. */
const LIENS_COMPTE: Lien[] = [
  { vers: '/commandes', libelle: 'Mes commandes' },
  { vers: '/reservations', libelle: 'Mes réservations' },
];

function classeLien({ isActive }: { isActive: boolean }): string {
  // Soulignement plutôt que pavé plein : la rubrique active se lit sans que
  // la barre change de hauteur ni de largeur d'une page à l'autre.
  const base =
    'relative whitespace-nowrap px-3 py-2 text-sm font-medium no-underline transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:transition-colors';
  return isActive
    ? `${base} text-primaire after:bg-primaire`
    : `${base} text-gris-700 hover:text-primaire after:bg-transparent`;
}

function classeLienMobile({ isActive }: { isActive: boolean }): string {
  const base =
    'block w-full rounded-lg px-3 py-2 text-left text-base font-medium transition-colors';
  return isActive
    ? `${base} bg-primaire text-white`
    : `${base} text-gris-700 hover:bg-gris-100`;
}

export default function MainLayout() {
  // La donnée vient d'un hook exposé par `features/commande/` : le layout
  // l'affiche sans rien savoir de la façon dont le panier est tenu.
  const { nombre } = usePanier();
  // Proposer « Mes commandes » à un visiteur non connecté le mènerait à une
  // page qu'il ne peut pas utiliser. Un salarié connecté n'atteint plus
  // jamais ce layout — `RouteClient` l'écarte vers `/personnel` avant que
  // `MainLayout` ne soit monté — donc ce booléen distingue, ici, « client
  // connecté » de « personne », rien d'autre à exclure.
  const connecte = useEstConnecte();

  const [menuOuvert, setMenuOuvert] = useState(false);
  const fermerMenu = () => setMenuOuvert(false);
  const deconnecter = useDeconnexion();
  const naviguer = useNavigate();

  function seDeconnecter() {
    // Ni jeton ni magasin à effacer nous-mêmes ici : `useDeconnexion` appelle
    // le serveur (seul capable d'effacer le cookie `httpOnly`) puis met à jour
    // le magasin réactif de session — la navigation ci-dessous n'a plus qu'à
    // suivre.
    void deconnecter().then(() => naviguer('/'));
  }

  const pastillePanier = nombre > 0 && (
    <span
      data-testid="compteur-panier"
      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1 text-xs font-semibold text-white"
    >
      {nombre}
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col bg-fond">
      <header className="sticky top-0 z-20 border-b border-gris-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="shrink-0 transition-opacity hover:opacity-80">
            <LogoDelta />
          </NavLink>

          <nav
            aria-label="Navigation principale"
            className="hidden items-center lg:flex"
          >
            {LIENS_PUBLICS.map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                end={lien.exact}
                className={classeLien}
              >
                {lien.libelle}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NavLink
              to="/panier"
              aria-label={nombre > 0 ? `Panier, ${nombre} article(s)` : 'Panier'}
              className={({ isActive }) =>
                `relative rounded-full p-2.5 transition-colors ${
                  isActive
                    ? 'bg-primaire/10 text-primaire'
                    : 'text-gris-700 hover:bg-gris-100 hover:text-primaire'
                }`
              }
            >
              <ShoppingCart size={22} aria-hidden />
              {pastillePanier}
            </NavLink>

            <div className="hidden lg:block">
              {connecte ? (
                <MenuCompte surDeconnexion={seDeconnecter} />
              ) : (
                <NavLink
                  to="/connexion"
                  className="flex items-center gap-2 rounded-full bg-action px-4 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-action-fonce"
                >
                  <UserRound size={18} aria-hidden />
                  Connexion
                </NavLink>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="rounded-lg p-2 text-gris-700 transition-colors hover:bg-gris-100 lg:hidden"
              aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOuvert}
            >
              {menuOuvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOuvert && (
          <nav
            aria-label="Menu"
            className="flex flex-col gap-1 border-t border-gris-200 bg-white px-4 py-4 lg:hidden"
          >
            {[...LIENS_PUBLICS, ...(connecte ? LIENS_COMPTE : [])].map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                end={lien.exact}
                className={classeLienMobile}
                onClick={fermerMenu}
              >
                {lien.libelle}
              </NavLink>
            ))}
            <div className="my-2 border-t border-gris-200" />
            {connecte ? (
              <button
                type="button"
                onClick={() => {
                  fermerMenu();
                  seDeconnecter();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-base font-medium text-gris-700 transition-colors hover:bg-gris-100"
              >
                Déconnexion
              </button>
            ) : (
              <NavLink
                to="/connexion"
                className={classeLienMobile}
                onClick={fermerMenu}
              >
                Connexion
              </NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Le routeur injecte ici la page correspondant à l'URL. */}
        <Outlet />
      </main>

      {/* Bulle de l'assistant IA (Sprint 12) : composant du module
          `assistant`, que le layout monte sans rien savoir de son
          fonctionnement — elle ne s'affiche que si l'assistant est activé. */}
      <BulleAssistant />

      <footer className="border-t border-gris-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-4 text-sm text-gris-500">
          <LogoDelta forme="symbole" className="h-6" />
          <span>Delta</span>
        </div>
      </footer>
    </div>
  );
}
