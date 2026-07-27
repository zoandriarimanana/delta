import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';

const racine = document.getElementById('root');

if (!racine) {
  // `strictNullChecks` impose de traiter ce cas : sans cette garde, TypeScript
  // refuse de passer un `HTMLElement | null` à createRoot.
  throw new Error("L'élément #root est introuvable dans index.html.");
}

ReactDOM.createRoot(racine).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
