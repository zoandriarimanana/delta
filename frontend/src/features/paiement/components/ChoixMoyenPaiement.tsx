/**
 * Choix du moyen de paiement : mobile money (par défaut) ou carte.
 *
 * Le numéro **décide de l'opérateur** : dès les trois premiers chiffres, la
 * tuile correspondante est sélectionnée (034/038 MVola, 032/037 Orange Money,
 * 033 Airtel Money). Le client n'a donc pas à savoir quel service porte son
 * numéro, et ne peut pas envoyer une combinaison que le serveur refuserait.
 */

import { useState } from 'react';
import { CreditCard, Lock, Smartphone } from 'lucide-react';

import { useTextes } from '@/lib/langue';

import {
  chiffresNumero,
  detecterOperateur,
  formaterNumero,
  infoOperateur,
  numeroComplet,
  OPERATEURS,
  type Operateur,
} from '../paiement.service';
import { TEXTES_PAIEMENT } from '../paiement.textes';
import type { PaiementEnvoye } from '../paiement.types';

interface Proprietes {
  montant: string;
  /** Hors Ariary, seule la carte est possible. */
  enAriary: boolean;
  numeroSuggere?: string;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: PaiementEnvoye) => void;
}

export default function ChoixMoyenPaiement({
  montant,
  enAriary,
  numeroSuggere,
  envoi,
  erreur,
  surEnvoi,
}: Proprietes) {
  const t = useTextes(TEXTES_PAIEMENT);
  const suggestion =
    numeroSuggere !== undefined && detecterOperateur(numeroSuggere) !== null
      ? formaterNumero(numeroSuggere)
      : '';
  const [parCarte, setParCarte] = useState(!enAriary);
  const [numero, setNumero] = useState(suggestion);
  const [operateur, setOperateur] = useState<Operateur>(
    detecterOperateur(suggestion) ?? 'Mvola'
  );
  const detecte = detecterOperateur(numero);
  const complet = numeroComplet(numero);
  const prefixeInconnu = chiffresNumero(numero).length >= 3 && detecte === null;
  const info = infoOperateur(operateur);

  function saisir(valeur: string) {
    setNumero(formaterNumero(valeur));
    const trouve = detecterOperateur(valeur);
    if (trouve !== null) setOperateur(trouve);
  }

  if (parCarte) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
            <CreditCard size={22} aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold text-gris-700">{t.titreCarte}</h3>
            <p className="text-sm text-gris-500">{t.carteDetail}</p>
          </div>
        </div>
        {!enAriary && (
          <p className="rounded-lg bg-primaire/5 p-3 text-sm text-gris-600">
            {t.carteSeulement}
          </p>
        )}
        <Erreur message={erreur} />
        <button
          type="button"
          disabled={envoi}
          onClick={() => surEnvoi({ methode: 'Carte', fournisseur: 'Stripe' })}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white shadow-md transition hover:bg-action-fonce disabled:opacity-60"
        >
          <Lock size={16} aria-hidden />
          {envoi ? t.envoi : t.payerCarte(montant)}
        </button>
        {enAriary && (
          <button
            type="button"
            onClick={() => setParCarte(false)}
            className="block w-full text-center text-sm font-medium text-primaire hover:underline"
          >
            {t.ouMobile}
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        surEnvoi({
          methode: 'Mobile_money',
          fournisseur: operateur,
          numero_mobile_money: chiffresNumero(numero),
        });
      }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
          <Smartphone size={22} aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold text-gris-700">{t.titreMobile}</h3>
          <p className="text-sm text-gris-500">{t.sousTitreMobile}</p>
        </div>
      </div>

      <fieldset>
        <legend className="sr-only">{t.operateur}</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPERATEURS.map((o) => {
            const actif = o.fournisseur === operateur;
            return (
              <label
                key={o.fournisseur}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition ${
                  actif
                    ? 'border-primaire bg-primaire/5 shadow-sm'
                    : 'border-gris-200 hover:border-gris-300'
                }`}
              >
                <input
                  type="radio"
                  name="operateur"
                  value={o.fournisseur}
                  checked={actif}
                  onChange={() => setOperateur(o.fournisseur)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold ${o.pastille}`}
                >
                  {o.initiales}
                </span>
                <span className="text-sm font-semibold text-gris-700">{o.nom}</span>
                <span className="text-xs text-gris-500">{o.prefixes.join(' · ')}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-gris-700">{t.numero}</span>
        <span className="mt-1 flex items-stretch overflow-hidden rounded-xl border-2 border-gris-300 bg-surface focus-within:border-primaire">
          <span className="flex items-center bg-gris-100 px-3 text-sm font-medium text-gris-600">
            🇲🇬 +261
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            value={numero}
            onChange={(evenement) => saisir(evenement.target.value)}
            placeholder={t.exempleNumero}
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-lg tracking-wide text-gris-700 focus:outline-none"
          />
        </span>
        {detecte !== null && (
          <span className="mt-1 block text-xs font-medium text-succes">
            {t.numeroDe(infoOperateur(detecte).nom)}
          </span>
        )}
        {prefixeInconnu && (
          <span className="mt-1 block text-xs font-medium text-danger">
            {t.numeroInconnu}
          </span>
        )}
      </label>

      <Erreur message={erreur} />

      <button
        type="submit"
        disabled={envoi || !complet || detecte === null}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-action px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-action-fonce disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Lock size={16} aria-hidden />
        {envoi ? t.envoi : t.payerAvec(montant, info.nom)}
      </button>

      <p className="flex items-start gap-2 text-xs text-gris-500">
        <Lock size={14} aria-hidden className="mt-0.5 shrink-0 text-succes" />
        {t.securite}
      </p>

      <button
        type="button"
        onClick={() => setParCarte(true)}
        className="block w-full text-center text-sm font-medium text-primaire hover:underline"
      >
        {t.ouCarte}
      </button>
    </form>
  );
}

function Erreur({ message }: { message: string | null }) {
  if (message === null) return null;
  // Repris tel quel : « Ce numéro n'est pas un numéro MVola », « cette
  // commande a déjà été payée » disent quoi corriger.
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
    >
      {message}
    </p>
  );
}
