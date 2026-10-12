import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  Bed,
  Building2,
  Check,
  ChefHat,
  Croissant,
  ShoppingCart,
  User,
} from 'lucide-react';

import fondAccueil from '@/assets/accueil-fond.jpg';

import { useTextes } from '@/lib/langue';
import { useEstConnecte } from '@/lib/useEstConnecte';

import { TEXTES_PAGES } from './pages.textes';

type Textes = (typeof TEXTES_PAGES)['fr'];

function modules(t: Textes, connecte: boolean) {
  return [
    {
      href: '/produits',
      title: t.produits,
      description: t.produitsDescription,
      icon: Croissant,
    },
    {
      href: '/formations',
      title: t.formations,
      description: t.formationsDescription,
      icon: ChefHat,
    },
    {
      href: '/salles',
      title: t.salles,
      description: t.sallesDescription,
      icon: Building2,
    },
    {
      href: '/logements',
      title: t.hebergement,
      description: t.hebergementDescription,
      icon: Bed,
    },
    {
      href: '/panier',
      title: t.panier,
      description: t.panierDescription,
      icon: ShoppingCart,
    },
    connecte
      ? {
          href: '/commandes',
          title: t.monCompte,
          description: t.compteClient,
          icon: User,
        }
      : {
          href: '/connexion',
          title: t.monCompte,
          description: t.compteVisiteur,
          icon: User,
        },
  ];
}

export default function AccueilPage() {
  const t = useTextes(TEXTES_PAGES);
  const [selectedHref, setSelectedHref] = useState<string | null>(null);
  const navigate = useNavigate();
  const connecte = useEstConnecte();
  const liste = modules(t, connecte);

  const handleModuleClick = (href: string) => {
    setSelectedHref(href);
    setTimeout(() => {
      navigate(href);
    }, 200);
  };

  return (
    <div className="space-y-12">
      {/* Bandeau d'accueil : la photo d'une boutique occupe toute la largeur
          de l'écran, au-delà du conteneur du layout. Le voile sombre est fixe
          (il dépend de la photo, pas du thème) : le texte reste lisible en
          mode clair comme en mode sombre. */}
      <section className="relative -mt-8 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        <img
          src={fondAccueil}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1633]/95 via-[#0a1633]/70 to-[#0a1633]/20" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-fond to-transparent" />

        <div className="relative mx-auto flex min-h-[520px] max-w-6xl flex-col justify-center px-4 pb-28 pt-16 md:min-h-[600px]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffb37a] sm:text-sm">
            {t.surtitre}
          </p>
          <h1 className="mt-4 max-w-2xl text-balance font-serif text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            {t.bienvenue}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">{t.accroche}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/produits"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-action px-7 py-3.5 font-semibold text-white no-underline shadow-lg transition hover:-translate-y-0.5 hover:bg-action-fonce"
            >
              {t.commanderProduits}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              to="/formations"
              className="inline-flex items-center justify-center rounded-full border-2 border-white/70 px-7 py-3 font-semibold text-white no-underline backdrop-blur-sm transition hover:bg-white/10"
            >
              {t.voirFormations}
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            {t.atouts.map((atout) => (
              <li key={atout} className="flex items-center gap-1.5">
                <Check size={16} aria-hidden className="text-[#ffb37a]" />
                {atout}
              </li>
            ))}
          </ul>
        </div>
        <p className="absolute bottom-2 right-3 text-[10px] text-white/50">
          {t.credit}
        </p>
      </section>

      {/* Grille de modules, remontée sur le bas de la photo */}
      <section className="relative z-10 -mt-32 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {liste.map((module) => (
          <ModuleCard
            key={module.href}
            href={module.href}
            title={module.title}
            description={module.description}
            icon={module.icon}
            isSelected={selectedHref === module.href}
            otherSelected={selectedHref !== null && selectedHref !== module.href}
            onSelect={handleModuleClick}
          />
        ))}
      </section>

      <p className="text-center text-sm italic text-gris-500">{t.devise}</p>

      {/* CTA section */}
      <section className="bg-primaire rounded-xl p-8 text-center">
        <h2 className="text-2xl font-serif font-bold text-sur-couleur mb-3">
          {t.decouvrir}
        </h2>
        <p className="text-sur-couleur/85 mb-6">{t.decouvrirTexte}</p>
        <a
          href="/produits"
          className="inline-block px-6 py-3 bg-surface text-primaire font-semibold rounded-lg hover:bg-gris-100 transition-colors"
        >
          {t.explorer}
        </a>
      </section>
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';

interface ModuleCardProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  isSelected: boolean;
  otherSelected: boolean;
  onSelect: (href: string) => void;
}

function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
  isSelected,
  otherSelected,
  onSelect,
}: ModuleCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(href);
    }
  };

  const baseClasses =
    'p-6 bg-surface rounded-xl border-l-4 border-primaire cursor-pointer transition-all duration-300';
  const selectedClasses = isSelected
    ? 'scale-105 shadow-xl'
    : 'shadow-md hover:shadow-xl hover:-translate-y-1 focus:ring-2 focus:ring-primaire';
  const fadeClasses = otherSelected ? 'opacity-60' : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(href)}
      onKeyDown={handleKeyDown}
      className={`${baseClasses} ${selectedClasses} ${fadeClasses}`}
    >
      <Icon className="w-8 h-8 text-primaire mb-3" />
      <h3 className="text-lg font-serif font-bold text-primaire mb-2">{title}</h3>
      <p className="text-sm text-gris-600">{description}</p>
    </div>
  );
}
