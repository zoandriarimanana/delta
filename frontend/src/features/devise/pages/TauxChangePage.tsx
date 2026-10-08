/**
 * Réglage des taux de change — administration.
 *
 * Paiement réel en devise (décision du 8 octobre 2026) : un client étranger
 * paie en EUR ou en USD, au taux réglé ici. Le taux est figé sur chaque
 * commande à sa création : le modifier ne change aucune commande passée.
 * Le serveur refuse en 403 un salarié sans droit : cette page ne vérifie
 * rien elle-même.
 */

import { useEffect, useState } from 'react';
import { Check, Coins } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';
import { formaterDate } from '@/features/commande/commande.service';

import { modifierTaux } from '../devise.api';
import { oublierTaux, useTaux } from '../devise.hooks';
import { formaterDevise, NOMS_DEVISES } from '../devise.service';
import type { TauxChange } from '../devise.types';

function message(erreur: unknown): string {
  const statut = (erreur as { response?: { status?: number } } | null)?.response
    ?.status;
  if (statut === 403) return 'Cette action est réservée aux administrateurs.';
  if (statut === 422) return 'Le taux doit être un nombre strictement positif.';
  return 'L’enregistrement a échoué. Réessayez dans un instant.';
}

export default function TauxChangePage() {
  const [version, setVersion] = useState(0);
  const taux = useTaux();

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
          <Coins size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gris-700">Taux de change</h1>
          <p className="mt-0.5 text-sm text-gris-500">
            Les clients étrangers paient en euros ou en dollars, au taux réglé ici. Le
            catalogue reste en Ariary. Un nouveau taux s’applique aux commandes
            suivantes, jamais à celles déjà passées.
          </p>
        </div>
      </div>

      {taux.length === 0 ? (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {taux.map((ligne) => (
            <FormulaireTaux
              key={`${ligne.devise}-${version}`}
              ligne={ligne}
              surEnregistre={() => {
                oublierTaux();
                setVersion((v) => v + 1);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FormulaireTaux({
  ligne,
  surEnregistre,
}: {
  ligne: TauxChange;
  surEnregistre: () => void;
}) {
  const [valeur, setValeur] = useState(ligne.ariary_par_unite);
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => setValeur(ligne.ariary_par_unite), [ligne.ariary_par_unite]);

  async function enregistrer(evenement: React.FormEvent) {
    evenement.preventDefault();
    setEnvoi(true);
    setRetour(null);
    try {
      await modifierTaux(ligne.devise, valeur);
      setRetour({ ok: true, texte: 'Taux enregistré.' });
      surEnregistre();
    } catch (erreur) {
      setRetour({ ok: false, texte: message(erreur) });
    } finally {
      setEnvoi(false);
    }
  }

  const exemple = Number(valeur) > 0 ? 10000 / Number(valeur) : null;

  return (
    <form
      onSubmit={enregistrer}
      className="rounded-2xl border border-gris-200 bg-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gris-700">
          {NOMS_DEVISES[ligne.devise]}
        </h2>
        <p className="text-xs text-gris-500">
          Mis à jour le {formaterDate(ligne.mis_a_jour_le)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gris-700">
            Ariary pour 1 {ligne.devise}
          </span>
          <input
            type="number"
            min="0.0001"
            step="0.0001"
            required
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            className="mt-1 block w-48 rounded-lg border border-gris-300 bg-surface px-3 py-2 text-gris-700 focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20"
          />
        </label>
        <Bouton type="submit" variante="valider" icone={Check} disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </div>

      {exemple !== null && (
        <p className="mt-3 text-sm text-gris-500">
          Exemple : un article à {formaterDevise(10000, 'MGA')} sera payé{' '}
          {formaterDevise(Math.round(exemple * 100) / 100, ligne.devise)}.
        </p>
      )}

      {retour !== null && (
        <p
          role={retour.ok ? 'status' : 'alert'}
          className={`mt-3 text-sm ${retour.ok ? 'text-succes' : 'text-danger'}`}
        >
          {retour.texte}
        </p>
      )}
    </form>
  );
}
