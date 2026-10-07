/**
 * Encart de suivi d'une livraison.
 *
 * Ne reçoit qu'un `SuiviLivraison` — statut et dates. Il n'a **aucun** moyen
 * d'afficher l'identité du livreur : le type ne la porte pas, l'API ne la
 * renvoie pas. L'absence est structurelle des deux côtés, pas une consigne de
 * rendu.
 */

import { Truck } from 'lucide-react';
import { formaterDate } from '@/features/commande/commande.service';

import { estParcoursNominal, libelleStatut } from '../livraison.service';
import type { SuiviLivraison as Suivi } from '../livraison.types';

interface Proprietes {
  suivi: Suivi;
}

export default function SuiviLivraison({ suivi }: Proprietes) {
  const { titre, explication, priseEnCharge } = libelleStatut(suivi.statut);
  const nominal = estParcoursNominal(suivi.statut);

  return (
    <section
      aria-label="Suivi de livraison"
      className={`mt-4 rounded-2xl border p-5 shadow-sm ${
        nominal ? 'border-gris-200 bg-surface' : 'border-attente/40 bg-attente/10'
      }`}
    >
      <h3 className="flex items-center gap-2 font-semibold text-gris-700">
        <Truck size={18} aria-hidden className="text-primaire" />
        Livraison — {titre}
      </h3>
      <p
        className="mt-1 text-sm text-gris-600"
        // `polite` et non `assertive` : l'information est utile, pas urgente.
        aria-live="polite"
      >
        {explication}
      </p>

      {/* Une tournée non planifiée n'affiche rien plutôt qu'un tiret : une
          ligne vide se lit comme une donnée manquante, son absence non. */}
      {suivi.date_heure_prevue !== null && (
        <p className="mt-2 text-sm text-gris-500">
          Prévue le{' '}
          <time dateTime={suivi.date_heure_prevue}>
            {formaterDate(suivi.date_heure_prevue)}
          </time>
        </p>
      )}

      {suivi.date_heure_reelle !== null && (
        <p className="mt-1 text-sm text-gris-500">
          Remise le{' '}
          <time dateTime={suivi.date_heure_reelle}>
            {formaterDate(suivi.date_heure_reelle)}
          </time>
        </p>
      )}

      {!priseEnCharge && (
        <p className="mt-2 text-sm text-attente">
          Contactez-nous si vous souhaitez repasser commande.
        </p>
      )}
    </section>
  );
}
