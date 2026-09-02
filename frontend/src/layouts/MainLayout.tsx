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
import { effacerJeton } from '@/lib/tokenStorage';
import { useEstConnecte, useEstPersonnelConnecte } from '@/lib/useEstConnecte';

const LIENS = [
  { vers: '/', libelle: 'Accueil', exact: true },
  { vers: '/produits', libelle: 'Catalogue', exact: false },
  { vers: '/formations', libelle: 'Formations', exact: false },
  { vers: '/salles', libelle: 'Salles', exact: false },
  { vers: '/logements', libelle: 'Hébergements', exact: false },
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
  // L'état de session vient de `lib/`, pas d'un module métier : il n'appartient
  // à aucun. Proposer « Mes commandes » à un visiteur non connecté le mènerait
  // à une page qu'il ne peut pas utiliser.
  const connecte = useEstConnecte();
  // Un salarié connecté n'est pas un client : les pages client lui répondraient
  // 401, ce qui effacerait sa session de travail. Les deux états s'excluent —
  // il n'y a qu'un jeton, et il porte une seule population.
  const personnel = useEstPersonnelConnecte();
  // Une session est ouverte, sans préjuger de laquelle : c'est ce qui décide
  // d'offrir « Connexion » ou « Déconnexion », les deux n'ayant jamais de sens
  // en même temps.
  const session = connecte || personnel;

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
            {!session && (
              <NavLink to="/connexion" className={classeLien}>
                Connexion
              </NavLink>
            )}
            {personnel && (
              <NavLink to="/personnel/commandes" className={classeLien}>
                Prise de commande
              </NavLink>
            )}
            {session && (
              <button
                type="button"
                onClick={() => {
                  effacerJeton();
                  // Rechargement plutôt qu'une navigation : l'état de session
                  // est lu au rendu, et rien ne le rediffuse aux composants
                  // montés. Le remplacer par un magasin réactif est une
                  // amélioration à part entière, pas un préalable.
                  window.location.assign('/');
                }}
                className="rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                Déconnexion
              </button>
            )}
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
