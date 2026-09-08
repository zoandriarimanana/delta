/**
 * Création d'un compte client.
 *
 * **Une seule page pour les deux sous-types**, contrairement aux deux pages de
 * connexion. La différence n'est pas une inconséquence : le choix
 * client/personnel découle du compte et ne doit pas être laissé à
 * l'utilisateur, alors que le choix particulier/entreprise **est** une
 * déclaration qui lui appartient. La page reflète l'API, où seul `identite`
 * change — les champs de compte vivent sur `CLIENT`, communs aux deux.
 *
 * **Aucune session n'est ouverte ici.** Après une inscription réussie, on
 * redirige vers l'écran de connexion avec un message de confirmation. Enchaîner
 * la connexion créerait un second point d'émission de jeton, implicite, alors
 * que le serveur n'en expose qu'un.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import ChampsEntreprise from '../components/ChampsEntreprise';
import ChampsParticulier from '../components/ChampsParticulier';
import { useInscriptionEntreprise, useInscriptionParticulier } from '../auth.hooks';
import type { IdentiteEntreprise, IdentiteParticulier } from '../auth.types';

type TypeCompte = 'particulier' | 'entreprise';

const PARTICULIER_VIDE: IdentiteParticulier = { nom: '', prenom: '' };
const ENTREPRISE_VIDE: IdentiteEntreprise = {
  raison_sociale: '',
  numero_id_fiscal: '',
};

/** Message porté jusqu'à l'écran de connexion par l'état de navigation. */
export const MESSAGE_COMPTE_CREE = 'Compte créé, connectez-vous pour continuer.';

export default function InscriptionPage() {
  const naviguer = useNavigate();
  const particulier = useInscriptionParticulier();
  const entreprise = useInscriptionEntreprise();

  const [type, setType] = useState<TypeCompte>('particulier');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [identiteParticulier, setIdentiteParticulier] =
    useState<IdentiteParticulier>(PARTICULIER_VIDE);
  const [identiteEntreprise, setIdentiteEntreprise] =
    useState<IdentiteEntreprise>(ENTREPRISE_VIDE);

  const courant = type === 'particulier' ? particulier : entreprise;

  function envoyer() {
    const compte = {
      email,
      mot_de_passe: motDePasse,
      // Une chaîne vide n'est pas un téléphone : on omet la clé plutôt que
      // d'envoyer `""`.
      ...(telephone ? { telephone } : {}),
    };
    const promesse =
      type === 'particulier'
        ? particulier.inscrire({ ...compte, identite: identiteParticulier })
        : entreprise.inscrire({ ...compte, identite: identiteEntreprise });

    void promesse.then((reussi) => {
      if (reussi) {
        naviguer('/connexion', {
          replace: true,
          state: { message: MESSAGE_COMPTE_CREE },
        });
      }
    });
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Créer un compte</h1>
      <p className="mt-2 text-sm text-slate-600">
        Pour suivre vos commandes et vos réservations.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          envoyer();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-700">Type de compte</legend>
          {(['particulier', 'entreprise'] as const).map((valeur) => (
            <label
              key={valeur}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="type_compte"
                value={valeur}
                checked={type === valeur}
                onChange={() => setType(valeur)}
              />
              {valeur === 'particulier' ? 'Particulier' : 'Entreprise'}
            </label>
          ))}
        </fieldset>

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
          Mot de passe <span className="text-slate-500">(8 caractères minimum)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Téléphone <span className="text-slate-500">(facultatif)</span>
          <input
            type="tel"
            value={telephone}
            onChange={(evenement) => setTelephone(evenement.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>

        {type === 'particulier' ? (
          <ChampsParticulier
            valeurs={identiteParticulier}
            surChangement={setIdentiteParticulier}
          />
        ) : (
          <ChampsEntreprise
            valeurs={identiteEntreprise}
            surChangement={setIdentiteEntreprise}
          />
        )}

        {courant.erreur !== null && (
          // Le message du serveur est repris tel quel : « cette adresse est
          // déjà utilisée » ou « ce numéro est déjà enregistré » disent quoi
          // corriger, et ne se corrigent pas de la même façon.
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {courant.erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={courant.envoi}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {courant.envoi ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Vous avez déjà un compte ?{' '}
        <Link to="/connexion" className="text-slate-900 underline">
          Se connecter
        </Link>
      </p>
    </section>
  );
}
