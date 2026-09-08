/** Route attrape-tout : URL inconnue. */
import { Link } from 'react-router';

export default function NonTrouveePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">404</h1>
      <p className="mt-2 text-slate-600">Cette page n’existe pas.</p>
      <Link to="/" className="mt-4 inline-block text-slate-900 underline">
        Retour à l’accueil
      </Link>
    </section>
  );
}
