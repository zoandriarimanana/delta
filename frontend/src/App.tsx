/**
 * Racine de l'application : routeur et table de routes, rien d'autre.
 *
 * Les routes des modules métier se greffent ici, en important leurs pages
 * depuis `features/<module>/pages/`.
 */

import { BrowserRouter, Route, Routes } from 'react-router';

import ConnexionPage from '@/features/auth/pages/ConnexionPage';
import ConnexionPersonnelPage from '@/features/auth/pages/ConnexionPersonnelPage';
import InscriptionPage from '@/features/auth/pages/InscriptionPage';
import CommandeInviteePage from '@/features/commande/pages/CommandeInviteePage';
import HistoriqueCommandesPage from '@/features/commande/pages/HistoriqueCommandesPage';
import PanierPage from '@/features/commande/pages/PanierPage';
import PriseDeCommandePage from '@/features/commande/pages/PriseDeCommandePage';
import TunnelCommandePage from '@/features/commande/pages/TunnelCommandePage';
import FormationDetailPage from '@/features/formation/pages/FormationDetailPage';
import FormationListPage from '@/features/formation/pages/FormationListPage';
import LogementDetailPage from '@/features/logement/pages/LogementDetailPage';
import LogementListPage from '@/features/logement/pages/LogementListPage';
import AdministrationCategoriesPage from '@/features/produit/pages/AdministrationCategoriesPage';
import AdministrationProduitsPage from '@/features/produit/pages/AdministrationProduitsPage';
import ProduitDetailPage from '@/features/produit/pages/ProduitDetailPage';
import ProduitListPage from '@/features/produit/pages/ProduitListPage';
import MesReservationsPage from '@/features/reservation/pages/MesReservationsPage';
import SalleDetailPage from '@/features/salle/pages/SalleDetailPage';
import SalleListPage from '@/features/salle/pages/SalleListPage';
import MainLayout from '@/layouts/MainLayout';
import RoutePersonnel from '@/lib/RoutePersonnel';
import SessionExpiree from '@/lib/SessionExpiree';
import AccueilPage from '@/pages/AccueilPage';
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
          <Route path="formations" element={<FormationListPage />} />
          <Route path="formations/:idFormation" element={<FormationDetailPage />} />
          <Route path="salles" element={<SalleListPage />} />
          <Route path="salles/:idSalle" element={<SalleDetailPage />} />
          <Route path="logements" element={<LogementListPage />} />
          <Route path="logements/:idLogement" element={<LogementDetailPage />} />
          <Route path="produits" element={<ProduitListPage />} />
          <Route path="produits/:idProduit" element={<ProduitDetailPage />} />
          <Route path="panier" element={<PanierPage />} />
          <Route path="commande" element={<TunnelCommandePage />} />
          {/* Déclarée avant `commandes` : sans quoi rien ne change ici, les
              deux chemins n'ayant pas le même nombre de segments — mais l'ordre
              reste plus lisible du plus spécifique au plus général. */}
          <Route path="commandes/invite/:reference" element={<CommandeInviteePage />} />
          <Route path="commandes" element={<HistoriqueCommandesPage />} />
          <Route path="reservations" element={<MesReservationsPage />} />
          <Route path="connexion" element={<ConnexionPage />} />
          <Route path="inscription" element={<InscriptionPage />} />
          <Route path="personnel/connexion" element={<ConnexionPersonnelPage />} />
          {/* Garde d'affichage seulement : la protection réelle est
              `get_current_personnel` côté serveur. */}
          <Route
            path="personnel/commandes"
            element={
              <RoutePersonnel>
                <PriseDeCommandePage />
              </RoutePersonnel>
            }
          />
          <Route
            path="personnel/catalogue"
            element={
              <RoutePersonnel>
                <AdministrationProduitsPage />
              </RoutePersonnel>
            }
          />
          <Route
            path="personnel/categories"
            element={
              <RoutePersonnel>
                <AdministrationCategoriesPage />
              </RoutePersonnel>
            }
          />
          <Route path="*" element={<NonTrouveePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
