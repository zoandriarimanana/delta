/**
 * Récapitulatif des lignes d'une commande enregistrée.
 *
 * Partagé par la page publique d'une commande invitée, l'historique du client
 * et la fiche d'administration : une seule présentation des montants et du
 * statut, qui ne peut pas diverger d'un écran à l'autre.
 *
 * Porte aussi le bouton « Déposer un avis », par ligne — le module `avis/`
 * fournit le formulaire, cette page ne fait que le monter une fois la
 * commande à son statut terminal (cf. `docs/architecture.md`, réservation ↔
 * catalogue : le module qui déclenche l'action monte le formulaire du module
 * concerné sans rien savoir de son implémentation).
 */

import { useState } from 'react';
import { Star } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import FormulaireAvis from '@/features/avis/components/FormulaireAvis';
import { montantAPayer } from '@/features/devise/devise.service';

import DemandePersonnalisationLue from './DemandePersonnalisationLue';
import VignetteProduit from './VignetteProduit';
import {
  estTerminee,
  formaterMontant,
  libelleStatutCommande,
  varianteStatutCommande,
} from '../commande.service';
import type { Commande, LigneCommandeLue } from '../commande.types';

interface Proprietes {
  commande: Commande;
  /**
   * `false` quand l'écran montre déjà le statut ailleurs — l'en-tête d'une
   * carte de « Mes commandes » — pour ne pas l'afficher deux fois.
   */
  afficherStatut?: boolean;
}

/** Montant d'une ligne, supplément de personnalisation compris. */
function montantLigne(ligne: LigneCommandeLue): number {
  return (
    (Number(ligne.prix_unitaire_applique) +
      Number(ligne.personnalisation?.supplement_prix ?? 0)) *
    ligne.quantite
  );
}

export default function RecapitulatifCommande({
  commande,
  afficherStatut = true,
}: Proprietes) {
  const frais = Number(commande.frais_livraison);
  const produits = commande.lignes.reduce((total, l) => total + montantLigne(l), 0);
  const livree = commande.adresse_livraison != null;

  return (
    <div>
      <ul className="divide-y divide-gris-200">
        {commande.lignes.map((ligne) => (
          <LigneAvecAvis
            key={ligne.id_ligne}
            ligne={ligne}
            proposerAvis={estTerminee(commande)}
          />
        ))}
      </ul>

      <dl className="mt-4 space-y-1.5 border-t border-gris-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-gris-500">Produits</dt>
          <dd className="text-gris-700">{formaterMontant(produits)}</dd>
        </div>
        {(frais > 0 || livree) && (
          <div className="flex justify-between">
            <dt className="text-gris-500">Livraison</dt>
            <dd className="text-gris-700">
              {frais > 0 ? formaterMontant(commande.frais_livraison) : 'Offerte'}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-gris-200 pt-2">
          <dt className="font-semibold text-gris-700">Total</dt>
          <dd className="text-xl font-bold text-primaire">
            {formaterMontant(commande.montant_total)}
          </dd>
        </div>
        {commande.devise !== undefined && commande.devise !== 'MGA' && (
          // Le client paie dans sa devise, au taux figé à la commande : c'est
          // ce montant-là qui fait foi pour lui, l'Ariary restant la référence.
          <div className="flex items-baseline justify-between rounded-lg bg-primaire/5 px-2 py-1.5">
            <dt className="font-semibold text-gris-700">À payer</dt>
            <dd className="text-right">
              <span className="text-lg font-bold text-primaire">
                {montantAPayer(commande)}
              </span>
              <span className="block text-xs text-gris-500">
                1 {commande.devise} = {formaterMontant(commande.taux_change ?? '1')}
              </span>
            </dd>
          </div>
        )}
        {afficherStatut && (
          <div className="flex items-center justify-between pt-1">
            <dt className="text-gris-500">Statut</dt>
            <dd>
              <Badge variante={varianteStatutCommande(commande.statut)}>
                {libelleStatutCommande(commande.statut)}
              </Badge>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function LigneAvecAvis({
  ligne,
  proposerAvis,
}: {
  ligne: LigneCommandeLue;
  proposerAvis: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <VignetteProduit
          idProduit={ligne.id_produit}
          nom={ligne.nom_produit}
          className="h-14 w-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-3">
            <span className="font-medium text-gris-700">
              {ligne.nom_produit} × {ligne.quantite}
            </span>
            <span className="whitespace-nowrap font-semibold text-gris-700">
              {formaterMontant(montantLigne(ligne))}
            </span>
          </div>
          <p className="text-xs text-gris-500">
            {formaterMontant(ligne.prix_unitaire_applique)} l’unité
          </p>
          {ligne.personnalisation != null && (
            <DemandePersonnalisationLue
              personnalisation={ligne.personnalisation}
              quantite={ligne.quantite}
            />
          )}
          {proposerAvis && !ouvert && (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primaire hover:underline"
            >
              <Star size={14} aria-hidden />
              Déposer un avis
            </button>
          )}
          {ouvert && <FormulaireAvis cible="Produit" idCible={ligne.id_ligne} />}
        </div>
      </div>
    </li>
  );
}
