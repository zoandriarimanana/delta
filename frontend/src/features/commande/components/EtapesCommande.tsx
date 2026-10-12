/**
 * Fil des étapes d'achat : Panier → Commande → Confirmation.
 *
 * Dit au client où il en est et combien il lui reste — un repère que les
 * sites marchands affichent tous, et dont l'absence rendait le parcours
 * flou. Purement visuel : il ne pilote aucune navigation.
 */

import { Check } from 'lucide-react';

import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';

const ETAPES = ['Panier', 'Commande', 'Paiement', 'Confirmation'] as const;

export type EtapeCommande = (typeof ETAPES)[number];

interface Proprietes {
  courante: EtapeCommande;
}

export default function EtapesCommande({ courante }: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const rangCourant = ETAPES.indexOf(courante);

  return (
    <ol aria-label={t.etapesCommande} className="flex items-center gap-2 text-sm">
      {ETAPES.map((etape, rang) => {
        const faite = rang < rangCourant;
        const active = rang === rangCourant;
        return (
          <li key={etape} className="flex items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-2 font-medium ${
                active ? 'text-primaire' : faite ? 'text-gris-600' : 'text-gris-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  active
                    ? 'bg-primaire text-sur-couleur'
                    : faite
                      ? 'bg-succes text-sur-couleur'
                      : 'bg-gris-200 text-gris-500'
                }`}
              >
                {faite ? <Check size={14} aria-hidden /> : rang + 1}
              </span>
              <span className="hidden sm:inline">{t.etapes[etape]}</span>
            </span>
            {rang < ETAPES.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-gris-300 sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
