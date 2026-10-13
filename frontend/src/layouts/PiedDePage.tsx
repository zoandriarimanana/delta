/**
 * Pied de page des pages publiques, monté par `MainLayout`.
 *
 * Il ne porte que ce qui est **vrai et stable** : les horaires (repris du
 * document « Horaires d'ouverture » de la base de connaissances), les liens
 * du site et les moyens de paiement réellement acceptés. Aucune adresse,
 * aucun téléphone : ils ne sont écrits nulle part dans le projet, et une
 * coordonnée inventée enverrait un client au mauvais endroit. Aucun lien
 * « Espace personnel » non plus, retiré de ce layout comme lien mort : un
 * salarié y accède depuis la page « Connexion ».
 *
 * Fond bleu nuit **fixe**, comme le voile du bandeau d'accueil : il ne dépend
 * pas du thème, et le texte clair s'y lit dans les deux modes.
 */

import { Clock, CreditCard, Truck } from 'lucide-react';
import { Link } from 'react-router';

import LogoDelta from '@/components/ui/LogoDelta';
import { OPERATEURS } from '@/features/paiement/paiement.service';
import { useTextes } from '@/lib/langue';
import { useEstConnecte } from '@/lib/useEstConnecte';

import { TEXTES_LAYOUT } from './layout.textes';

interface Lien {
  vers: string;
  libelle: string;
}

export default function PiedDePage() {
  const t = useTextes(TEXTES_LAYOUT);
  const connecte = useEstConnecte();

  const decouvrir: Lien[] = [
    { vers: '/produits', libelle: t.produits },
    { vers: '/formations', libelle: t.formations },
    { vers: '/salles', libelle: t.salles },
    { vers: '/logements', libelle: t.hebergements },
  ];
  const espace: Lien[] = connecte
    ? [
        { vers: '/commandes', libelle: t.mesCommandes },
        { vers: '/reservations', libelle: t.mesReservations },
        { vers: '/panier', libelle: t.panier },
      ]
    : [
        { vers: '/connexion', libelle: t.connexion },
        { vers: '/inscription', libelle: t.creerCompte },
        { vers: '/panier', libelle: t.panier },
      ];

  return (
    <footer className="mt-16 bg-[#0a1633] text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-flex rounded-xl bg-white px-3 py-2 no-underline"
            aria-label={t.retourAccueil}
          >
            <LogoDelta className="h-8" />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed">{t.presentation}</p>
          <div className="flex items-start gap-2 text-sm">
            <Clock size={16} aria-hidden className="mt-0.5 shrink-0 text-[#ffb37a]" />
            <p>
              <span className="block font-semibold text-white">{t.horaires}</span>
              {t.horairesSemaine}
              <span className="block text-white/55">{t.horairesFermeture}</span>
            </p>
          </div>
        </div>

        <Colonne titre={t.decouvrir} liens={decouvrir} />
        <Colonne titre={t.votreEspace} liens={espace} />

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
            {t.paiementAccepte}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {OPERATEURS.map((o) => (
              <li
                key={o.fournisseur}
                className={`rounded-full px-3 py-1 text-xs font-bold ${o.pastille}`}
              >
                {o.nom}
              </li>
            ))}
            <li className="flex items-center gap-1 rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white">
              <CreditCard size={13} aria-hidden />
              {t.carteBancaire}
            </li>
          </ul>
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Truck size={16} aria-hidden className="shrink-0 text-[#ffb37a]" />
            {t.livraisonDomicile}
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/50">
          {t.droits(new Date().getFullYear())}
        </p>
      </div>
    </footer>
  );
}

function Colonne({ titre, liens }: { titre: string; liens: Lien[] }) {
  return (
    <nav aria-label={titre}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
        {titre}
      </h2>
      <ul className="mt-4 space-y-2 text-sm">
        {liens.map((lien) => (
          <li key={lien.vers}>
            <Link
              to={lien.vers}
              className="text-white/75 no-underline transition hover:text-white hover:underline"
            >
              {lien.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
