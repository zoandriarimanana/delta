/**
 * Structure de page transverse : en-tête, navigation, pied de page.
 *
 * Le compteur de panier et le lien conditionné à la session sont affichés ici,
 * mais aucune règle métier n'y est écrite : les deux valeurs viennent de hooks
 * — `usePanier` exposé par `features/commande/`, `useEstConnecte` par `lib/` —
 * que ce layout consomme sans rien savoir de leur implémentation
 * (cf. `docs/architecture.md`).
 */

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Menu, X } from 'lucide-react';

import { usePanier } from '@/features/commande/commande.hooks';
import { useEstConnecte } from '@/lib/useEstConnecte';

const LIENS = [
  { vers: '/', libelle: 'Accueil', exact: true },
  { vers: '/produits', libelle: 'Produits', exact: false },
  { vers: '/formations', libelle: 'Formations', exact: false },
  { vers: '/salles', libelle: 'Salles', exact: false },
  { vers: '/logements', libelle: 'Hébergements', exact: false },
];

function classeLien({ isActive }: { isActive: boolean }): string {
  const base = 'px-3 py-2 text-sm font-medium transition-colors rounded-lg';
  return isActive
    ? `${base} bg-terracotta text-white`
    : `${base} text-warm-gray-700 hover:bg-warm-gray-100`;
}

function classeLienMobile({ isActive }: { isActive: boolean }): string {
  const base = 'block px-3 py-2 text-base font-medium transition-colors rounded-lg w-full text-left';
  return isActive
    ? `${base} bg-terracotta text-white`
    : `${base} text-warm-gray-700 hover:bg-warm-gray-100`;
}

export default function MainLayout() {
  const { nombre } = usePanier();
  const connecte = useEstConnecte();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b-2 border-warm-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <NavLink to="/" className="text-2xl font-bold text-terracotta font-serif hover:text-burgundy transition-colors">
            Delta
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {LIENS.map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                end={lien.exact}
                className={classeLien}
              >
                {lien.libelle}
              </NavLink>
            ))}
            {connecte && (
              <NavLink to="/commandes" className={classeLien}>
                Mes commandes
              </NavLink>
            )}
            {connecte && (
              <NavLink to="/reservations" className={classeLien}>
                Mes réservations
              </NavLink>
            )}
            <NavLink to="/panier" className={classeLien}>
              Panier
              {nombre > 0 && (
                <span
                  data-testid="compteur-panier"
                  className="ml-2 inline-block rounded-full bg-terracotta px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {nombre}
                </span>
              )}
            </NavLink>
            {!connecte && (
              <NavLink to="/connexion" className={classeLien}>
                Connexion
              </NavLink>
            )}
          </nav>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-warm-gray-700 hover:bg-warm-gray-100 rounded-lg transition-colors"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-warm-gray-200 bg-white px-4 py-4 flex flex-col gap-2">
            {LIENS.map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                end={lien.exact}
                className={classeLienMobile}
                onClick={closeMenu}
              >
                {lien.libelle}
              </NavLink>
            ))}
            {connecte && (
              <NavLink to="/commandes" className={classeLienMobile} onClick={closeMenu}>
                Mes commandes
              </NavLink>
            )}
            {connecte && (
              <NavLink to="/reservations" className={classeLienMobile} onClick={closeMenu}>
                Mes réservations
              </NavLink>
            )}
            <NavLink to="/panier" className={classeLienMobile} onClick={closeMenu}>
              <span className="flex items-center justify-between">
                <span>Panier</span>
                {nombre > 0 && (
                  <span
                    data-testid="compteur-panier"
                    className="ml-2 inline-block rounded-full bg-terracotta px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    {nombre}
                  </span>
                )}
              </span>
            </NavLink>
            {!connecte && (
              <NavLink to="/connexion" className={classeLienMobile} onClick={closeMenu}>
                Connexion
              </NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t-2 border-warm-gray-200 bg-white mt-12">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-warm-gray-500">
          <p className="mb-2">© {new Date().getFullYear()} Delta — Plateforme de cantine, restauration, formation et hébergement</p>
          <p className="text-xs">Fait avec passion pour l'artisanat et la qualité</p>
        </div>
      </footer>
    </div>
  );
}
