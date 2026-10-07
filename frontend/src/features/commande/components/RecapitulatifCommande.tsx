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
}

/** Montant d'une ligne, supplément de personnalisation compris. */
function montantLigne(ligne: LigneCommandeLue): number {
  return (
    (Number(ligne.prix_unitaire_applique) +
      Number(ligne.personnalisation?.supplement_prix ?? 0)) *
    ligne.quantite
  );
}

export default function RecapitulatifCommande({ commande }: Proprietes) {
  const frais = Number(commande.frais_livraison);
  const produits = commande.lignes.reduce((total, l) => total + montantLigne(l), 0);
  const livree = commande.adresse_livraison != null;

  return (
    <div>
      <ul className="divide-y divide-warm-gray-200">
        {commande.lignes.map((ligne) => (
          <LigneAvecAvis
            key={ligne.id_ligne}
            ligne={ligne}
            proposerAvis={estTerminee(commande)}
          />
        ))}
      </ul>

      <dl className="mt-4 space-y-1.5 border-t border-warm-gray-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-warm-gray-500">Produits</dt>
          <dd className="text-warm-gray-700">{formaterMontant(produits)}</dd>
        </div>
        {(frais > 0 || livree) && (
          <div className="flex justify-between">
            <dt className="text-warm-gray-500">Livraison</dt>
            <dd className="text-warm-gray-700">
              {frais > 0 ? formaterMontant(commande.frais_livraison) : 'Offerte'}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-warm-gray-200 pt-2">
          <dt className="font-semibold text-warm-gray-700">Total</dt>
          <dd className="text-xl font-bold text-terracotta">
            {formaterMontant(commande.montant_total)}
          </dd>
        </div>
        <div className="flex items-center justify-between pt-1">
          <dt className="text-warm-gray-500">Statut</dt>
          <dd>
            <Badge variante={varianteStatutCommande(commande.statut)}>
              {libelleStatutCommande(commande.statut)}
            </Badge>
          </dd>
        </div>
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
            <span className="font-medium text-warm-gray-700">
              {ligne.nom_produit} × {ligne.quantite}
            </span>
            <span className="whitespace-nowrap font-semibold text-warm-gray-700">
              {formaterMontant(montantLigne(ligne))}
            </span>
          </div>
          <p className="text-xs text-warm-gray-500">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
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
