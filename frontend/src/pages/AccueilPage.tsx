import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Croissant, ChefHat, Building2, Bed, ShoppingCart, User } from 'lucide-react';

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
      {/* Hero section */}
      <section className="text-center py-8">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primaire mb-4">
          {t.bienvenue}
        </h1>
        <p className="text-lg text-gris-600 max-w-2xl mx-auto mb-2">{t.accroche}</p>
        <p className="text-sm text-gris-500">{t.devise}</p>
      </section>

      {/* Grille de modules */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
