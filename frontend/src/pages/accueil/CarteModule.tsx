/**
 * Carte d'un module sur la page d'accueil — effet de verre (« glassmorphism »).
 *
 * Posée sur la photo du bandeau : un fond translucide flouté ne se voit que
 * sur un fond sombre. Ses couleurs sont donc fixes, comme le voile de la
 * photo — elles dépendent de l'image, pas du thème clair ou sombre.
 *
 * L'illustration, quand il y en a une, reste un fond discret qui zoome au
 * survol : elle donne l'ambiance sans jamais gêner la lecture.
 */

import { Link } from 'react-router';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface Proprietes {
  vers: string;
  titre: string;
  description: string;
  icone: LucideIcon;
  /** Libellé de l'appel « Découvrir », révélé au survol. */
  appel: string;
  image?: string;
}

export default function CarteModule({
  vers,
  titre,
  description,
  icone: Icone,
  appel,
  image,
}: Proprietes) {
  return (
    <Link
      to={vers}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 no-underline shadow-2xl shadow-black/30 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-amber-400/50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
    >
      {image && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-25 transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
        </div>
      )}

      <div className="relative flex h-full flex-col">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30 transition-colors duration-300 group-hover:bg-amber-400/25">
          <Icone size={24} aria-hidden />
        </span>

        <h3 className="mt-5 text-lg font-bold tracking-tight text-white">{titre}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-300">
          {description}
        </p>

        <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-amber-200 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
          {appel}
          <ArrowRight
            size={16}
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}
