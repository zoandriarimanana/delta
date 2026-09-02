/**
 * Connexion d'un client.
 *
 * Remplace le gabarit `src/pages/ConnexionPage.tsx`, resté vide depuis le
 * Sprint 0 : `docs/architecture.md` prévoyait dès l'origine qu'une page de
 * connexion appartient à `features/auth/` dès que ce module existe.
 *
 * Distincte de la connexion personnel, parce que l'endpoint l'est : c'est lui
 * qui détermine la population du jeton émis. Une page unique avec une case
 * « je suis salarié » laisserait le choix de la population à l'utilisateur,
 * alors qu'il découle de son compte.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useConnexionClient } from '../auth.hooks';

export default function ConnexionPage() {
  const naviguer = useNavigate();
  const { connecter, envoi, erreur } = useConnexionClient();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
      <p className="mt-2 text-sm text-slate-600">
        Retrouvez vos commandes et vos réservations.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void connecter({ email, mot_de_passe: motDePasse }).then((reussi) => {
            if (reussi) {
              naviguer('/');
            }
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Adresse e-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Mot de passe
          <input
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>

        {erreur !== null && (
          // Le message du serveur est repris tel quel. Il est **uniforme** pour
          // tout refus — adresse inconnue, mot de passe faux, compte archivé —,
          // donc le reprendre ne révèle pas si le compte existe.
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Vous êtes membre de l’équipe Delta ?{' '}
        <Link to="/personnel/connexion" className="text-slate-900 underline">
          Espace personnel
        </Link>
      </p>
    </section>
  );
}
