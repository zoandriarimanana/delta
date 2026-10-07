/**
 * Tunnel de commande : récapitulatif, identité si invité, validation.
 *
 * Après validation, l'invité est redirigé vers la page publique de sa commande —
 * une URL qu'il peut mettre en favori, plutôt qu'un UUID à recopier depuis un
 * écran de confirmation éphémère.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useEstConnecte } from '@/lib/useEstConnecte';

import ChoixReception from '../components/ChoixReception';
import EtapesCommande from '../components/EtapesCommande';
import RecapitulatifMontants from '../components/RecapitulatifMontants';
import { usePanier, useValidationCommande } from '../commande.hooks';
import {
  formaterMontant,
  TYPE_PAR_MODE,
  type ModeReception,
} from '../commande.service';
import type { Commande } from '../commande.types';

export default function TunnelCommandePage() {
  const panier = usePanier();
  const connecte = useEstConnecte();
  const { valider, envoi, erreur } = useValidationCommande();
  const naviguer = useNavigate();

  // Retrait par défaut : la commande n'est jamais bloquée par une adresse
  // manquante, et la livraison reste un choix explicite.
  const [mode, setMode] = useState<ModeReception>('retrait');
  const [adresse, setAdresse] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [confirmee, setConfirmee] = useState<Commande | null>(null);

  if (confirmee !== null) {
    return (
      <section>
        <EtapesCommande courante="Confirmation" />
        <h1 className="mt-6 text-2xl font-semibold text-slate-900">
          Commande enregistrée
        </h1>
        <p className="mt-2 text-slate-700">
          Votre commande n° {confirmee.id_commande} est enregistrée pour un montant de{' '}
          {formaterMontant(confirmee.montant_total)}
          {Number(confirmee.frais_livraison) > 0 && (
            <>, dont {formaterMontant(confirmee.frais_livraison)} de livraison</>
          )}
          .
        </p>
        <Link to="/produits" className="mt-6 inline-block text-slate-900 underline">
          Retour au catalogue
        </Link>
      </section>
    );
  }

  if (panier.lignes.length === 0) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Commande</h1>
        <p className="mt-2 text-slate-600">
          Votre panier est vide, il n’y a rien à commander.
        </p>
        <Link to="/produits" className="mt-4 inline-block text-slate-900 underline">
          Parcourir le catalogue
        </Link>
      </section>
    );
  }

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    const commande = await valider(
      TYPE_PAR_MODE[mode],
      connecte ? undefined : { nom_invite: nom, contact_invite: contact },
      mode === 'livraison' ? adresse : undefined
    );
    if (commande === null) {
      // Échec : le panier est intact, l'erreur est affichée, on reste ici.
      return;
    }
    if (commande.reference_publique !== null) {
      naviguer(`/commandes/invite/${commande.reference_publique}`, {
        replace: true,
      });
      return;
    }
    setConfirmee(commande);
  }

  return (
    <section>
      <EtapesCommande courante="Commande" />
      <h1 className="mt-6 text-2xl font-semibold text-slate-900">Commande</h1>

      <ul className="mt-6 divide-y divide-slate-200">
        {panier.lignes.map((ligne) => (
          <li key={ligne.id_produit} className="flex justify-between py-2">
            <span className="text-slate-900">
              {ligne.nom} × {ligne.quantite}
            </span>
            <span className="text-slate-700">
              {formaterMontant(Number(ligne.prix_unitaire) * ligne.quantite)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 max-w-md sm:ml-auto">
        <RecapitulatifMontants
          sousTotal={panier.total}
          avecLivraison={mode === 'livraison'}
        />
      </div>

      <form onSubmit={soumettre} className="mt-6 max-w-2xl space-y-4">
        <ChoixReception
          mode={mode}
          adresse={adresse}
          surMode={setMode}
          surAdresse={setAdresse}
        />

        {!connecte && (
          <>
            <p className="text-sm text-slate-600">
              Vous commandez sans compte. Ces informations nous permettent de vous
              recontacter.
            </p>
            <label className="block">
              <span className="text-sm text-slate-700">Nom</span>
              <input
                required
                value={nom}
                onChange={(evenement) => setNom(evenement.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-700">Téléphone ou e-mail</span>
              <input
                required
                value={contact}
                onChange={(evenement) => setContact(evenement.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          </>
        )}

        {erreur !== null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-3 text-red-800"
          >
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {envoi ? 'Envoi…' : 'Valider la commande'}
        </button>
      </form>
    </section>
  );
}
