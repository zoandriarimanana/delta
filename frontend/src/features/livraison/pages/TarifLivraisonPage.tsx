/**
 * Réglage du tarif de livraison — administration.
 *
 * Forfait unique, compté une fois par commande, et seuil au-delà duquel la
 * livraison est offerte (décision du 7 octobre 2026). Le serveur refuse en
 * 403 un salarié sans droit : cette page ne vérifie rien elle-même.
 *
 * Seule page du module `livraison`, dont le suivi n'en a pas
 * (`docs/architecture.md`) : régler un tarif est une destination, suivre une
 * tournée ne l'est pas.
 */

import { useEffect, useState } from 'react';

import Bouton from '@/components/ui/Bouton';
import { formaterMontant } from '@/features/commande/commande.service';

import { modifierTarifLivraison } from '../livraison.api';
import { useTarifLivraison } from '../livraison.hooks';

function message(erreur: unknown): string {
  const reponse = (
    erreur as { response?: { status?: number; data?: { detail?: unknown } } } | null
  )?.response;
  if (reponse?.status === 403) {
    return 'Cette action est réservée aux administrateurs.';
  }
  if (reponse?.status === 422) {
    return 'Montants invalides : le forfait doit être positif ou nul, le seuil strictement positif.';
  }
  return 'L’enregistrement a échoué. Réessayez dans un instant.';
}

export default function TarifLivraisonPage() {
  const { tarif, chargement, erreur, recharger } = useTarifLivraison();
  const [forfait, setForfait] = useState('');
  const [avecSeuil, setAvecSeuil] = useState(true);
  const [seuil, setSeuil] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    if (tarif === null) return;
    setForfait(tarif.forfait);
    setAvecSeuil(tarif.seuil_gratuite !== null);
    setSeuil(tarif.seuil_gratuite ?? '');
  }, [tarif]);

  async function enregistrer(evenement: React.FormEvent) {
    evenement.preventDefault();
    setEnvoi(true);
    setRetour(null);
    try {
      await modifierTarifLivraison({
        forfait,
        seuil_gratuite: avecSeuil ? seuil : null,
      });
      recharger();
      setRetour({
        ok: true,
        texte: 'Tarif enregistré. Il s’applique aux prochaines commandes.',
      });
    } catch (erreurAppel) {
      setRetour({ ok: false, texte: message(erreurAppel) });
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement && tarif === null) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }
  if (erreur || tarif === null) {
    return (
      <p role="alert" className="text-danger">
        Le tarif de livraison n’a pas pu être chargé.
      </p>
    );
  }

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gris-700">Tarif de livraison</h1>
      <p className="mt-2 text-sm text-gris-500">
        Un forfait unique, compté une seule fois par commande quel que soit le nombre
        d’articles. Les commandes déjà passées gardent les frais du jour où elles ont
        été faites.
      </p>

      <div className="mt-4 rounded-xl border border-gris-200 bg-surface p-4 text-sm text-gris-600">
        Actuellement : <strong>{formaterMontant(tarif.forfait)}</strong> par livraison
        {tarif.seuil_gratuite !== null ? (
          <>
            , offerte dès <strong>{formaterMontant(tarif.seuil_gratuite)}</strong>{' '}
            d’achat.
          </>
        ) : (
          ', jamais offerte.'
        )}
      </div>

      <form
        onSubmit={(e) => void enregistrer(e)}
        className="mt-6 space-y-4 rounded-xl border border-gris-200 bg-surface p-4"
      >
        <label className="flex flex-col gap-1 text-sm text-gris-700">
          Forfait de livraison (Ar)
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={forfait}
            onChange={(e) => setForfait(e.target.value)}
            className="rounded border border-gris-300 px-2 py-1"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gris-700">
          <input
            type="checkbox"
            checked={avecSeuil}
            onChange={(e) => setAvecSeuil(e.target.checked)}
          />
          Offrir la livraison à partir d’un montant d’achat
        </label>

        {avecSeuil && (
          <label className="flex flex-col gap-1 text-sm text-gris-700">
            Livraison offerte dès (Ar)
            <input
              type="number"
              required
              min={0.01}
              step="0.01"
              value={seuil}
              onChange={(e) => setSeuil(e.target.value)}
              className="rounded border border-gris-300 px-2 py-1"
            />
            <span className="text-xs text-gris-500">
              Comparé au montant des produits seuls, hors frais de livraison.
            </span>
          </label>
        )}

        {retour !== null && (
          <p
            role={retour.ok ? 'status' : 'alert'}
            className={`rounded p-3 text-sm ${
              retour.ok ? 'bg-succes/10 text-succes' : 'bg-danger/10 text-danger'
            }`}
          >
            {retour.texte}
          </p>
        )}

        <Bouton variante="valider" type="submit" disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </form>
    </section>
  );
}
