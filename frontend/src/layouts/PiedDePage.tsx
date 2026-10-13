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

import { Clock, CreditCard, LockKeyhole, Truck } from 'lucide-react';
import { Link } from 'react-router';

import LogoDelta from '@/components/ui/LogoDelta';
import { OPERATEURS } from '@/features/paiement/paiement.service';
import { useTextes } from '@/lib/langue';
import { useEstConnecte } from '@/lib/useEstConnecte';

import { TEXTES_LAYOUT } from './layout.textes';

/** Page Facebook de Delta, réglée dans `frontend/.env`. Sans adresse
 * connue, l'icône reste affichée **sans lien** (choix de l'utilisateur, 13
 * octobre 2026) plutôt que de pointer vers une page inventée ; elle devient
 * cliquable dès que l'adresse est renseignée. */
const URL_FACEBOOK = (import.meta.env.VITE_FACEBOOK_URL ?? '').trim();
const URL_DIGITHEQUE = 'https://digitheque.net';

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
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.droits(new Date().getFullYear())}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {URL_FACEBOOK ? (
              <a
                href={URL_FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.facebook}
                title={t.facebook}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1877F2] text-white transition hover:brightness-110"
              >
                <IconeFacebook />
              </a>
            ) : (
              <span
                role="img"
                aria-label={t.facebook}
                title={t.facebook}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1877F2] text-white"
              >
                <IconeFacebook />
              </span>
            )}
            {/* Discret, en bas de page : l'équipe le connaît, un client n'a
                pas à le chercher. La connexion reste protégée côté serveur. */}
            <Link
              to="/personnel/connexion"
              className="inline-flex items-center gap-1.5 text-white/60 no-underline transition hover:text-white"
            >
              <LockKeyhole size={13} aria-hidden />
              {t.administration}
            </Link>
            <p>
              {t.developpePar}{' '}
              <a
                href={URL_DIGITHEQUE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white/80 underline underline-offset-2 hover:text-white"
              >
                Digitheque
              </a>
            </p>
          </div>
        </div>
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

/** Logo « f » de Facebook — absent de lucide, qui ne porte plus de logos de
 * marque. */
function IconeFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M9.2 21.5h4v-8h3.6l.4-4h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2H7.2l-.4 4h2.4v8Z" />
    </svg>
  );
}
