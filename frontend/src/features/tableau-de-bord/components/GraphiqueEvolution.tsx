/**
 * Courbe du chiffre d'affaires sur la période (14 octobre 2026) : un point
 * par jour, ou par mois au-delà de 30 jours. Dessinée en SVG, sans
 * bibliothèque ; le survol d'un point en donne le détail.
 */

import { useState } from 'react';

import { formaterMontant } from '@/features/commande/commande.service';

import type { PointVentes } from '../tableauDeBord.types';

const LARGEUR = 720;
const HAUTEUR = 220;
const MARGE = { haut: 16, droite: 12, bas: 28, gauche: 12 };

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

function etiquette(iso: string, pas: 'jour' | 'mois'): string {
  const date = new Date(`${iso}T12:00:00`);
  return (pas === 'jour' ? JOUR : MOIS).format(date);
}

interface Proprietes {
  points: PointVentes[];
  pas: 'jour' | 'mois';
}

export default function GraphiqueEvolution({ points, pas }: Proprietes) {
  const [survole, setSurvole] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="py-10 text-center text-gris-500">Aucune vente à afficher.</p>;
  }

  const valeurs = points.map((p) => Number(p.chiffre_affaires));
  const max = Math.max(...valeurs, 1);
  const largeurUtile = LARGEUR - MARGE.gauche - MARGE.droite;
  const hauteurUtile = HAUTEUR - MARGE.haut - MARGE.bas;
  const x = (i: number) =>
    MARGE.gauche +
    (points.length === 1 ? largeurUtile / 2 : (i / (points.length - 1)) * largeurUtile);
  const y = (v: number) => MARGE.haut + hauteurUtile - (v / max) * hauteurUtile;

  const ligne = valeurs
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`)
    .join(' ');
  const aire = `${ligne} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  // Une étiquette sur quelques-unes seulement, pour rester lisible.
  const pasEtiquette = Math.max(1, Math.ceil(points.length / 8));
  const detail = survole === null ? undefined : points[survole];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        role="img"
        aria-label="Évolution du chiffre d’affaires"
        className="h-auto w-full"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={MARGE.gauche}
            x2={LARGEUR - MARGE.droite}
            y1={y(max * f)}
            y2={y(max * f)}
            className="stroke-gris-200"
            strokeDasharray="4 4"
          />
        ))}
        <path d={aire} className="fill-primaire/15" />
        <path d={ligne} className="fill-none stroke-primaire" strokeWidth={2.5} />
        {points.map((p, i) => (
          <g key={p.debut}>
            {/* Zone de survol pleine hauteur, plus facile à viser qu'un point. */}
            <rect
              x={x(i) - largeurUtile / points.length / 2}
              y={MARGE.haut}
              width={largeurUtile / points.length}
              height={hauteurUtile}
              className="fill-transparent"
              onMouseEnter={() => setSurvole(i)}
              onMouseLeave={() => setSurvole(null)}
            />
            <circle
              cx={x(i)}
              cy={y(valeurs[i] ?? 0)}
              r={survole === i ? 5 : 3}
              className="pointer-events-none fill-primaire"
            />
            {i % pasEtiquette === 0 && (
              <text
                x={x(i)}
                y={HAUTEUR - 8}
                // Aux deux bouts, l'étiquette s'aligne vers l'intérieur pour
                // ne pas sortir du cadre.
                textAnchor={
                  i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
                }
                className="fill-gris-500 text-[11px]"
              >
                {etiquette(p.debut, pas)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 min-h-5 text-center text-sm text-gris-600">
        {detail === undefined ? (
          <>
            Survolez la courbe pour le détail d’un {pas === 'jour' ? 'jour' : 'mois'}.
          </>
        ) : (
          <>
            <strong className="text-gris-700">{etiquette(detail.debut, pas)}</strong> —{' '}
            {formaterMontant(detail.chiffre_affaires)} · {detail.nombre_commandes}{' '}
            commande(s)
          </>
        )}
      </figcaption>
    </figure>
  );
}
