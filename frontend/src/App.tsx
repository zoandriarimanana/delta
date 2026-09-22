/**
 * Racine de l'application : routeur et table de routes, rien d'autre.
 *
 * Les routes des modules métier se greffent ici, en important leurs pages
 * depuis `features/<module>/pages/`.
 */

import { BrowserRouter, Route, Routes } from 'react-router';

import AbonnementDetailAdministrationPage from '@/features/abonnement/pages/AbonnementDetailAdministrationPage';
import AdministrationAbonnementsPage from '@/features/abonnement/pages/AdministrationAbonnementsPage';
import ConnexionPage from '@/features/auth/pages/ConnexionPage';
import ConnexionPersonnelPage from '@/features/auth/pages/ConnexionPersonnelPage';
import InscriptionPage from '@/features/auth/pages/InscriptionPage';
import AdministrationCommandesPage from '@/features/commande/pages/AdministrationCommandesPage';
import CommandeDetailAdministrationPage from '@/features/commande/pages/CommandeDetailAdministrationPage';
import CommandeInviteePage from '@/features/commande/pages/CommandeInviteePage';
import HistoriqueCommandesPage from '@/features/commande/pages/HistoriqueCommandesPage';
import PanierPage from '@/features/commande/pages/PanierPage';
import PriseDeCommandePage from '@/features/commande/pages/PriseDeCommandePage';
import TunnelCommandePage from '@/features/commande/pages/TunnelCommandePage';
import AdministrationDomainesPage from '@/features/formation/pages/AdministrationDomainesPage';
import FormationDetailPage from '@/features/formation/pages/FormationDetailPage';
import FormationListPage from '@/features/formation/pages/FormationListPage';
import AdministrationLogementsPage from '@/features/logement/pages/AdministrationLogementsPage';
import LogementDetailPage from '@/features/logement/pages/LogementDetailPage';
import LogementListPage from '@/features/logement/pages/LogementListPage';
import AdministrationCategoriesPage from '@/features/produit/pages/AdministrationCategoriesPage';
import AdministrationProduitsPage from '@/features/produit/pages/AdministrationProduitsPage';
import ProduitDetailPage from '@/features/produit/pages/ProduitDetailPage';
import ProduitListPage from '@/features/produit/pages/ProduitListPage';
import AdministrationPersonnelPage from '@/features/personnel/pages/AdministrationPersonnelPage';
import PersonnelDetailAdministrationPage from '@/features/personnel/pages/PersonnelDetailAdministrationPage';
import AdministrationReservationsPage from '@/features/reservation/pages/AdministrationReservationsPage';
import MesReservationsPage from '@/features/reservation/pages/MesReservationsPage';
import ReservationDetailAdministrationPage from '@/features/reservation/pages/ReservationDetailAdministrationPage';
import AdministrationSallesPage from '@/features/salle/pages/AdministrationSallesPage';
import SalleDetailPage from '@/features/salle/pages/SalleDetailPage';
import SalleListPage from '@/features/salle/pages/SalleListPage';
import LayoutPersonnel from '@/layouts/LayoutPersonnel';
import MainLayout from '@/layouts/MainLayout';
import InitialisationSession from '@/lib/InitialisationSession';
import RoutePersonnel from '@/lib/RoutePersonnel';
import SessionExpiree from '@/lib/SessionExpiree';
import AccueilPage from '@/pages/AccueilPage';
import NonTrouveePage from '@/pages/NonTrouveePage';

export default function App() {
  return (
    <BrowserRouter>
      {/* Hors <Routes> : ces deux effets doivent être actifs quelle que soit la
          route affichée — l'écouteur de session expirée, et la vérification
          initiale de session au chargement. */}
      <SessionExpiree />
      <InitialisationSession />
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
          {/* Reste sur `MainLayout`, hors de la sidebar `personnel/*`
              ci-dessous : c'est la porte d'entrée de cet espace, pas
              l'espace lui-même — une sidebar n'a pas de sens avant qu'une
              session existe (chantier sidebar, décision actée). */}
          <Route path="personnel/connexion" element={<ConnexionPersonnelPage />} />
          <Route path="*" element={<NonTrouveePage />} />
        </Route>

        {/* Route parente unique pour tout l'espace personnel/* (hors
            connexion, ci-dessus) : une seule garde `RoutePersonnel` au lieu
            d'une répétition par route, et `LayoutPersonnel` (sidebar) plutôt
            que `MainLayout`. Les 11 routes suivantes sont déclarées en
            chemins relatifs à `personnel`. */}
        <Route
          path="personnel"
          element={
            <RoutePersonnel>
              <LayoutPersonnel />
            </RoutePersonnel>
          }
        >
          <Route path="commandes" element={<PriseDeCommandePage />} />
          <Route path="catalogue" element={<AdministrationProduitsPage />} />
          <Route path="categories" element={<AdministrationCategoriesPage />} />
          {/* Déclarée avant la route paramétrée : même précaution que
              `commandes/invite/:reference` avant `commandes` — ici les deux
              chemins n'ont de toute façon pas la même forme, mais la
              convention reste de lister du plus spécifique au plus général. */}
          <Route path="abonnements" element={<AdministrationAbonnementsPage />} />
          <Route
            path="abonnements/:idAbonnement"
            element={<AbonnementDetailAdministrationPage />}
          />
          {/* Même précaution : `/administration` avant la route paramétrée. */}
          <Route path="administration" element={<AdministrationPersonnelPage />} />
          <Route
            path="administration/:idPersonnel"
            element={<PersonnelDetailAdministrationPage />}
          />
          <Route path="reservations" element={<AdministrationReservationsPage />} />
          <Route
            path="reservations/:idReservation"
            element={<ReservationDetailAdministrationPage />}
          />
          {/* Distincte de `commandes` (prise de commande, Sprint 6) : chemins
              de longueurs différentes, aucune collision possible. */}
          <Route
            path="commandes/administration"
            element={<AdministrationCommandesPage />}
          />
          <Route
            path="commandes/administration/:idCommande"
            element={<CommandeDetailAdministrationPage />}
          />
          <Route path="salles" element={<AdministrationSallesPage />} />
          <Route path="logements" element={<AdministrationLogementsPage />} />
          <Route path="domaines-formation" element={<AdministrationDomainesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
