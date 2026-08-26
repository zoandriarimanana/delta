/**
 * Structure de page transverse : en-tête, navigation, pied de page.
 *
 * Le compteur de panier et le lien conditionné à la session sont affichés ici,
 * mais aucune règle métier n'y est écrite : les deux valeurs viennent de hooks
 * — `usePanier` exposé par `features/commande/`, `useEstConnecte` par `lib/` —
 * que ce layout consomme sans rien savoir de leur implémentation
 * (cf. `docs/architecture.md`).
 */

import { NavLink, Outlet } from 'react-router';

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

export default function MainLayout() {
  const { nombre } = usePanier();
  const connecte = useEstConnecte();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b-2 border-warm-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <NavLink to="/" className="text-2xl font-bold text-terracotta font-serif hover:text-burgundy transition-colors">
            Delta
          </NavLink>
          <nav className="flex gap-1">
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t-2 border-warm-gray-200 bg-white mt-12">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-warm-gray-500">
          <p className="mb-2">© 2024 Delta — Plateforme de cantine, restauration, formation et hébergement</p>
          <p className="text-xs">Fait avec passion pour l'artisanat et la qualité</p>
        </div>
      </footer>
    </div>
  );
}
