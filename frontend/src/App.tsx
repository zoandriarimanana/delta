/**
 * Racine de l'application : routeur et table de routes, rien d'autre.
 *
 * Les routes des modules métier se greffent ici, en important leurs pages
 * depuis `features/<module>/pages/`.
 */

import { BrowserRouter, Route, Routes } from 'react-router';

import CommandeInviteePage from '@/features/commande/pages/CommandeInviteePage';
import HistoriqueCommandesPage from '@/features/commande/pages/HistoriqueCommandesPage';
import PanierPage from '@/features/commande/pages/PanierPage';
import TunnelCommandePage from '@/features/commande/pages/TunnelCommandePage';
import ProduitDetailPage from '@/features/produit/pages/ProduitDetailPage';
import ProduitListPage from '@/features/produit/pages/ProduitListPage';
import MainLayout from '@/layouts/MainLayout';
import SessionExpiree from '@/lib/SessionExpiree';
import AccueilPage from '@/pages/AccueilPage';
import ConnexionPage from '@/pages/ConnexionPage';
import NonTrouveePage from '@/pages/NonTrouveePage';

export default function App() {
  return (
    <BrowserRouter>
      {/* Hors <Routes> : l'écouteur de session expirée doit être actif quelle
          que soit la route affichée. */}
      <SessionExpiree />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<AccueilPage />} />
          <Route path="produits" element={<ProduitListPage />} />
          <Route path="produits/:idProduit" element={<ProduitDetailPage />} />
          <Route path="panier" element={<PanierPage />} />
          <Route path="commande" element={<TunnelCommandePage />} />
          {/* Déclarée avant `commandes` : sans quoi rien ne change ici, les
              deux chemins n'ayant pas le même nombre de segments — mais l'ordre
              reste plus lisible du plus spécifique au plus général. */}
          <Route path="commandes/invite/:reference" element={<CommandeInviteePage />} />
          <Route path="commandes" element={<HistoriqueCommandesPage />} />
          <Route path="connexion" element={<ConnexionPage />} />
          <Route path="*" element={<NonTrouveePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
