/** Route attrape-tout : URL inconnue. */
import { Link } from 'react-router';

export default function NonTrouveePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-gris-700">404</h1>
      <p className="mt-2 text-gris-600">Cette page n’existe pas.</p>
      <Link to="/" className="mt-4 inline-block text-gris-700 underline">
        Retour à l’accueil
      </Link>
    </section>
  );
}
