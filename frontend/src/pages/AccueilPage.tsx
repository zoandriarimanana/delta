import { Croissant, ChefHat, Building2, Bed, ShoppingCart, User } from 'lucide-react';

export default function AccueilPage() {
  return (
    <div className="space-y-12">
      {/* Hero section */}
      <section className="text-center py-8">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-terracotta mb-4">
          Bienvenue chez Delta
        </h1>
        <p className="text-lg text-warm-gray-600 max-w-2xl mx-auto mb-2">
          Plateforme artisanale pour la pâtisserie, restauration, formation culinaire et hébergement.
        </p>
        <p className="text-sm text-warm-gray-500">
          Qualité, tradition et professionnalisme
        </p>
      </section>

      {/* Grille de modules */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard
          href="/produits"
          title="Produits"
          description="Pâtisserie, boulangerie, confiture et spécialités"
          icon={Croissant}
        />
        <ModuleCard
          href="/formations"
          title="Formations"
          description="Ateliers et sessions de formation culinaire"
          icon={ChefHat}
        />
        <ModuleCard
          href="/salles"
          title="Salles"
          description="Location d'espaces pour vos réunions et événements"
          icon={Building2}
        />
        <ModuleCard
          href="/logements"
          title="Hébergement"
          description="Chambres confortables pour vos séjours"
          icon={Bed}
        />
        <ModuleCard
          href="/panier"
          title="Panier"
          description="Passez votre commande en ligne"
          icon={ShoppingCart}
        />
        <ModuleCard
          href="/connexion"
          title="Mon compte"
          description="Connectez-vous pour gérer vos réservations"
          icon={User}
        />
      </section>

      {/* CTA section */}
      <section className="bg-terracotta rounded-xl p-8 text-center">
        <h2 className="text-2xl font-serif font-bold text-white mb-3">
          Découvrez notre offre
        </h2>
        <p className="text-warm-gray-100 mb-6">
          Explorez notre catalogue de produits, formations et services. Tous les détails vous attendent.
        </p>
        <a
          href="/produits"
          className="inline-block px-6 py-3 bg-white text-terracotta font-semibold rounded-lg hover:bg-warm-gray-100 transition-colors"
        >
          Commencer à explorer
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
}

function ModuleCard({ href, title, description, icon: Icon }: ModuleCardProps) {
  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-l-4 border-terracotta"
    >
      <Icon className="w-8 h-8 text-terracotta mb-3" />
      <h3 className="text-lg font-serif font-bold text-terracotta mb-2">{title}</h3>
      <p className="text-sm text-warm-gray-600">{description}</p>
    </a>
  );
}
