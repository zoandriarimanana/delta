/**
 * Racine de l'application : routeur et table de routes, rien d'autre.
 *
 * Pas de dossier `features/` à ce stade (Sprint 0) — les modules métier et
 * leurs routes viendront s'y greffer au sprint 1.
 */

import { BrowserRouter, Route, Routes } from 'react-router';

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
          <Route path="connexion" element={<ConnexionPage />} />
          <Route path="*" element={<NonTrouveePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
