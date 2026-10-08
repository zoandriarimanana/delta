/** Route attrape-tout : URL inconnue. */
import { Link } from 'react-router';

import { useTextes } from '@/lib/langue';

import { TEXTES_PAGES } from './pages.textes';

export default function NonTrouveePage() {
  const t = useTextes(TEXTES_PAGES);
  return (
    <section>
      <h1 className="text-2xl font-semibold text-gris-700">404</h1>
      <p className="mt-2 text-gris-600">{t.introuvable}</p>
      <Link to="/" className="mt-4 inline-block text-gris-700 underline">
        {t.retourAccueil}
      </Link>
    </section>
  );
}
