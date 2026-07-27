/**
 * Page de connexion — volontairement vide.
 *
 * Le formulaire fonctionnel n'est pas au périmètre du Sprint 0 : il viendra
 * avec `features/auth/` au sprint 1. Cette route existe dès maintenant parce
 * que `SessionExpiree` y redirige en cas de jeton rejeté, et qu'une redirection
 * vers une route inexistante tomberait sur la page 404.
 */
export default function ConnexionPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
      <p className="mt-2 text-slate-600">
        Formulaire à implémenter au sprint 1 (module <code>features/auth</code>).
      </p>
    </section>
  );
}
