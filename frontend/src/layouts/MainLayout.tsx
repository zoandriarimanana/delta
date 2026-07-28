/**
 * Structure de page transverse : en-tête, navigation, pied de page.
 *
 * Aucune donnée métier ici, et aucune logique de session — pas de « Bonjour
 * X », pas de compteur de panier, pas de lien conditionné à l'état de
 * connexion. Quand ces éléments arriveront, ils viendront de hooks exposés par
 * les modules concernés (`features/<module>/`), que ce layout consommera sans
 * rien savoir de leur implémentation (cf. `docs/architecture.md`).
 */

import { NavLink, Outlet } from 'react-router';

import { usePanier } from '@/features/commande/commande.hooks';

const LIENS = [
  { vers: '/', libelle: 'Accueil', exact: true },
  { vers: '/produits', libelle: 'Catalogue', exact: false },
  { vers: '/connexion', libelle: 'Connexion', exact: false },
];

function classeLien({ isActive }: { isActive: boolean }): string {
  const base = 'rounded px-3 py-2 text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-slate-900 text-white`
    : `${base} text-slate-700 hover:bg-slate-200`;
}

export default function MainLayout() {
  // La donnée vient d'un hook exposé par `features/commande/` : le layout
  // l'affiche sans rien savoir de la façon dont le panier est tenu. Aucune
  // logique métier n'est écrite ici (cf. `docs/architecture.md`).
  const { nombre } = usePanier();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xl font-semibold text-slate-900">Delta</span>
          <nav className="flex gap-2">
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
            <NavLink to="/panier" className={classeLien}>
              Panier
              {nombre > 0 && (
                <span
                  data-testid="compteur-panier"
                  className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white"
                >
                  {nombre}
                </span>
              )}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Le routeur injecte ici la page correspondant à l'URL. */}
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-slate-500">
          Delta — squelette Sprint 0
        </div>
      </footer>
    </div>
  );
}
