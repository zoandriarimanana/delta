/**
 * Connexion du personnel.
 *
 * Distincte de la connexion client, parce que l'endpoint l'est : c'est lui qui
 * détermine la population du jeton émis. Une page unique avec une case « je
 * suis salarié » laisserait le choix de la population à l'utilisateur, alors
 * qu'il découle de son compte.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useConnexionPersonnel } from '../auth.hooks';

export default function ConnexionPersonnelPage() {
  const naviguer = useNavigate();
  const { connecter, envoi, erreur } = useConnexionPersonnel();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Espace personnel</h1>
      <p className="mt-2 text-sm text-slate-600">
        Réservé aux membres de l’équipe Delta.
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
          Adresse professionnelle
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
          // tout refus — identifiant inconnu, mot de passe faux, compte sans
          // connexion, compte archivé —, donc le reprendre ne divulgue rien.
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
    </section>
  );
}
