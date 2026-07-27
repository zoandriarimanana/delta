import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// `vitest/config` étend `vite`, ce qui permet de garder une seule configuration
// pour le build et les tests — l'alias `@` reste ainsi valable dans les deux.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Doit rester synchronisé avec `compilerOptions.paths` de tsconfig.json :
      // TypeScript résout les types, Vite résout les modules à l'exécution.
      // L'un sans l'autre compile mais casse au chargement.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Port aligné sur BACKEND_CORS_ORIGINS (backend/.env) : c'est cette origine
    // que l'API autorise. La changer ici impose de la changer là-bas.
    port: 5173,
    strictPort: true,
  },
  test: {
    // jsdom fournit `window` et `localStorage`, dont dépendent le stockage du
    // jeton et l'émission de l'événement de déconnexion.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
