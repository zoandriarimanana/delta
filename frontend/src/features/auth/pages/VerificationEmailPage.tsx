/**
 * Confirmation de l'adresse e-mail (14 octobre 2026).
 *
 * Un compte inscrit naît **non vérifié** : la connexion est refusée tant que
 * le code à 6 chiffres reçu par e-mail n'a pas été saisi ici. L'adresse
 * arrive de l'inscription (ou de la connexion refusée) par l'état de
 * navigation ; elle reste modifiable.
 *
 * Le renvoi d'un code affiche toujours le même message, que l'adresse ait un
 * compte ou non : comme le serveur, l'écran ne renseigne sur aucun compte.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useTextes } from '@/lib/langue';

import { renvoyerCode, verifierEmail } from '../auth.api';
import { messageDeRefus } from '../auth.service';
import { TEXTES_AUTH } from '../auth.textes';

export default function VerificationEmailPage() {
  const t = useTextes(TEXTES_AUTH);
  const naviguer = useNavigate();
  const recue = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(recue);
  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function valider() {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      await verifierEmail(email, code);
      naviguer('/connexion', { replace: true, state: { message: t.adresseConfirmee } });
    } catch (erreurAppel) {
      setErreur(messageDeRefus(erreurAppel));
    } finally {
      setEnvoi(false);
    }
  }

  async function renvoyer() {
    setErreur(null);
    setInfo(null);
    try {
      await renvoyerCode(email);
      setInfo(t.codeRenvoye);
    } catch (erreurAppel) {
      setErreur(messageDeRefus(erreurAppel));
    }
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gris-700">{t.verification}</h1>
      <p className="mt-2 text-sm text-gris-600">{t.verificationSousTitre}</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void valider();
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-gris-700">
          {t.email}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            className="rounded border border-gris-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gris-700">
          {t.code}
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(evenement) => setCode(evenement.target.value.replace(/\D/g, ''))}
            className="rounded border border-gris-300 px-2 py-2 text-center text-xl tracking-[0.5em]"
          />
        </label>

        {erreur !== null && (
          <p
            role="alert"
            className="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            {erreur}
          </p>
        )}
        {info !== null && (
          <p
            role="status"
            className="rounded border border-succes/30 bg-succes/10 p-3 text-sm text-succes"
          >
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi || code.length !== 6}
          className="w-full rounded bg-action px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {envoi ? t.validation : t.valider}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void renvoyer()}
        disabled={email === ''}
        className="mt-4 text-sm font-medium text-primaire underline disabled:opacity-50"
      >
        {t.renvoyerCode}
      </button>

      <p className="mt-6 text-sm text-gris-600">
        {t.dejaUnCompte}{' '}
        <Link to="/connexion" className="text-gris-700 underline">
          {t.seConnecter}
        </Link>
      </p>
    </section>
  );
}
