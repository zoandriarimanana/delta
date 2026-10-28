/**
 * Page d'accueil.
 *
 * La photo d'une boutique couvre tout le haut de la page, sous l'en-tête
 * transparent (`MainLayout`), et porte à la fois le bandeau et les cartes
 * des modules, en verre. Le voile chocolat et les accents dorés sont des
 * couleurs fixes : ils dépendent de la photo, pas du thème — le texte reste
 * lisible en mode clair comme en mode sombre. Les boutons gardent l'orange
 * du logo (`action`).
 */

import { Link } from 'react-router';
import {
  ArrowRight,
  Bed,
  Building2,
  Check,
  ChefHat,
  Croissant,
  ShoppingCart,
  User,
  type LucideIcon,
} from 'lucide-react';

import fondAccueil from '@/assets/accueil-fond.jpg';

import { imagePour } from '@/lib/images';
import { useTextes } from '@/lib/langue';
import { useEstConnecte } from '@/lib/useEstConnecte';

import CarteModule from './accueil/CarteModule';
import { TEXTES_PAGES } from './pages.textes';

type Textes = (typeof TEXTES_PAGES)['fr'];

interface Module {
  vers: string;
  titre: string;
  description: string;
  icone: LucideIcon;
  image?: string;
}

function modules(t: Textes, connecte: boolean): Module[] {
  return [
    {
      vers: '/produits',
      titre: t.produits,
      description: t.produitsDescription,
      icone: Croissant,
      image: imagePour('patisserie', 0, 600),
    },
    {
      vers: '/formations',
      titre: t.formations,
      description: t.formationsDescription,
      icone: ChefHat,
      image: imagePour('formation', 0, 600),
    },
    {
      vers: '/salles',
      titre: t.salles,
      description: t.sallesDescription,
      icone: Building2,
      image: imagePour('salle', 0, 600),
    },
    {
      vers: '/logements',
      titre: t.hebergement,
      description: t.hebergementDescription,
      icone: Bed,
      image: imagePour('logement', 0, 600),
    },
    {
      vers: '/panier',
      titre: t.panier,
      description: t.panierDescription,
      icone: ShoppingCart,
    },
    {
      vers: connecte ? '/commandes' : '/connexion',
      titre: t.monCompte,
      description: connecte ? t.compteClient : t.compteVisiteur,
      icone: User,
    },
  ];
}

export default function AccueilPage() {
  const t = useTextes(TEXTES_PAGES);
  const connecte = useEstConnecte();

  return (
    <div className="space-y-16 pb-8">
      {/* Bandeau pleine largeur, au-delà du conteneur du layout, qui remonte
          sous l'en-tête transparent. */}
      <section className="relative -mt-8 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        <img
          src={fondAccueil}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute inset-0 h-full w-full scale-105 object-cover object-center blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f08]/85 via-[#1a0f08]/70 to-[#1a0f08]/90" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-fond to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-32 sm:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300 sm:text-sm">
              {t.surtitre}
            </p>
            <h1 className="mt-6 text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl">
              {t.bienvenue}
            </h1>
            <div
              aria-hidden
              className="mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-amber-300 to-transparent"
            />
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">
              {t.accroche}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/produits"
                className="inline-flex transform items-center justify-center gap-2 rounded-full bg-action px-8 py-3.5 font-semibold text-white no-underline shadow-lg shadow-black/30 transition-all duration-300 hover:scale-105 hover:bg-action-fonce hover:shadow-xl hover:shadow-action/30"
              >
                {t.commanderProduits}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link
                to="/formations"
                className="inline-flex transform items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 py-3.5 font-semibold text-white no-underline shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-amber-300/60 hover:bg-white/15"
              >
                {t.voirFormations}
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/80">
              {t.atouts.map((atout) => (
                <li key={atout} className="flex items-center gap-2">
                  <Check size={16} aria-hidden className="text-amber-300" />
                  {atout}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modules(t, connecte).map((module) => (
              <CarteModule
                key={module.titre}
                vers={module.vers}
                titre={module.titre}
                description={module.description}
                icone={module.icone}
                image={module.image}
                appel={t.decouvrirCarte}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center gap-4">
        <span aria-hidden className="h-px w-12 bg-amber-400/60" />
        <p className="text-center font-serif text-sm italic text-gris-500">
          {t.devise}
        </p>
        <span aria-hidden className="h-px w-12 bg-amber-400/60" />
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primaire to-primaire-fonce px-6 py-12 text-center shadow-xl sm:px-12">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"
        />
        <h2 className="font-serif text-2xl font-bold text-sur-couleur sm:text-3xl">
          {t.decouvrir}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sur-couleur/85">{t.decouvrirTexte}</p>
        <Link
          to="/produits"
          className="mt-8 inline-flex transform items-center gap-2 rounded-full bg-surface px-7 py-3 font-semibold text-primaire no-underline shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
        >
          {t.explorer}
          <ArrowRight size={18} aria-hidden />
        </Link>
      </section>
    </div>
  );
}
