/**
 * Tableau de bord de l'administration (14 octobre 2026).
 *
 * Chiffres clés de la période, puis les produits qui se vendent le plus —
 * classés par quantité ou par chiffre d'affaires, au choix. Une vente, c'est
 * une commande confirmée, en préparation, livrée ou servie (cf.
 * `TableauDeBordService`) : ni une commande en attente, ni une annulée.
 *
 * Réservé aux administrateurs par le serveur (403) ; la route ne protège rien.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  BarChart3,
  Clock,
  Package,
  ReceiptText,
  ShoppingBasket,
  Wallet,
} from 'lucide-react';

import { formaterMontant } from '@/features/commande/commande.service';
import { urlPhotoPartie } from '@/features/galerie/galerie.api';
import { useCouvertures } from '@/features/galerie/galerie.hooks';
import type { PartieCatalogue } from '@/features/galerie/galerie.types';
import { imageFormation, imageProduit } from '@/lib/images';

import GraphiqueCategories from '../components/GraphiqueCategories';
import GraphiqueEvolution from '../components/GraphiqueEvolution';
import GraphiqueColonnes from '../components/GraphiqueColonnes';

import { useTableauDeBord } from '../tableauDeBord.hooks';
import {
  classer,
  classerFormations,
  type Classement,
  type ClassementFormations,
} from '../tableauDeBord.service';
import type { Periode } from '../tableauDeBord.types';

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: '7j', libelle: '7 jours' },
  { valeur: '30j', libelle: '30 jours' },
  { valeur: '12m', libelle: '12 mois' },
  { valeur: 'tout', libelle: 'Tout' },
];

const CLASSES_BASCULE =
  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors aria-pressed:bg-primaire aria-pressed:text-sur-couleur';

export default function TableauDeBordPage() {
  const [periode, setPeriode] = useState<Periode>('30j');
  const [classement, setClassement] = useState<Classement>('quantite');
  const { donnees, chargement, erreur } = useTableauDeBord(periode);
  const [classementFormations, setClassementFormations] =
    useState<ClassementFormations>('inscrits');
  const couverturesProduits = useCouvertures('produits');
  const couverturesFormations = useCouvertures('formations');

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
            <BarChart3 size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-gris-700">Tableau de bord</h1>
            <p className="mt-0.5 text-sm text-gris-500">
              Ventes et inscriptions de la période. Une vente : commande confirmée, en
              préparation, livrée ou servie ; une inscription : réservation de formation
              confirmée ou honorée.
            </p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Période"
          className="flex gap-1 rounded-xl bg-surface p-1 shadow-sm"
        >
          {PERIODES.map(({ valeur, libelle }) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={periode === valeur}
              onClick={() => setPeriode(valeur)}
              className={`${CLASSES_BASCULE} text-gris-600 hover:bg-gris-100`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      {erreur !== null && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {erreur}
        </p>
      )}

      {chargement && donnees === null && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      {donnees !== null && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicateur
              icone={Wallet}
              libelle="Chiffre d’affaires"
              valeur={formaterMontant(donnees.chiffre_affaires)}
            />
            <Indicateur
              icone={ReceiptText}
              libelle="Commandes"
              valeur={String(donnees.nombre_commandes)}
            />
            <Indicateur
              icone={ShoppingBasket}
              libelle="Panier moyen"
              valeur={formaterMontant(donnees.panier_moyen)}
            />
            <Link
              to="/personnel/commandes/administration"
              className="no-underline"
              title="Voir les commandes"
            >
              <Indicateur
                icone={Clock}
                libelle="À confirmer (toutes dates)"
                valeur={String(donnees.commandes_a_confirmer)}
                attention={donnees.commandes_a_confirmer > 0}
              />
            </Link>
          </div>

          <Panneau titre="Évolution du chiffre d’affaires" className="mt-6">
            <GraphiqueEvolution points={donnees.evolution} pas={donnees.pas} />
          </Panneau>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Panneau
              titre="Produits les plus vendus"
              className="lg:col-span-2"
              actions={
                <Bascule
                  libelle="Classer les produits par"
                  options={[
                    { valeur: 'quantite', libelle: 'Quantité' },
                    { valeur: 'chiffre', libelle: 'Chiffre d’affaires' },
                  ]}
                  choix={classement}
                  surChoix={setClassement}
                />
              }
            >
              <GraphiqueColonnes
                titre="Produits les plus vendus"
                vide="Aucune vente sur cette période."
                colonnes={classer(donnees.produits, classement).map((p) => ({
                  cle: String(p.id_produit),
                  nom: p.nom,
                  valeur:
                    classement === 'quantite'
                      ? p.unites_vendues
                      : Number(p.chiffre_affaires),
                  libelle:
                    classement === 'quantite'
                      ? String(p.unites_vendues)
                      : formaterMontant(p.chiffre_affaires),
                  image: imageDe(couverturesProduits, 'produits', p.id_produit, () =>
                    imageProduit(p.id_produit, p.nom)
                  ),
                  lien: `/personnel/catalogue/${p.id_produit}`,
                  detail: `${p.nom} — ${p.unites_vendues} vendu(s), ${formaterMontant(
                    p.chiffre_affaires
                  )}, ${p.nombre_commandes} commande(s)`,
                }))}
              />
            </Panneau>
            <Panneau titre="Ventes par catégorie">
              <GraphiqueCategories categories={donnees.categories} />
            </Panneau>
          </div>

          <Panneau
            titre="Formations les plus demandées"
            className="mt-6"
            actions={
              <Bascule
                libelle="Classer les formations par"
                options={[
                  { valeur: 'inscrits', libelle: 'Inscrits' },
                  { valeur: 'chiffre', libelle: 'Chiffre d’affaires' },
                ]}
                choix={classementFormations}
                surChoix={setClassementFormations}
              />
            }
          >
            <p className="-mt-2 mb-4 text-sm text-gris-500">
              Réservations confirmées ou honorées sur la période :{' '}
              <strong className="text-gris-700">
                {donnees.formations.reduce((s, f) => s + f.inscrits, 0)} inscrit(s)
              </strong>{' '}
              ·{' '}
              <strong className="text-gris-700">
                {formaterMontant(
                  donnees.formations.reduce((s, f) => s + Number(f.chiffre_affaires), 0)
                )}
              </strong>
            </p>
            <GraphiqueColonnes
              titre="Formations les plus demandées"
              vide="Aucune inscription sur cette période."
              colonnes={classerFormations(donnees.formations, classementFormations).map(
                (f) => ({
                  cle: String(f.id_formation),
                  nom: f.titre,
                  valeur:
                    classementFormations === 'inscrits'
                      ? f.inscrits
                      : Number(f.chiffre_affaires),
                  libelle:
                    classementFormations === 'inscrits'
                      ? `${f.inscrits} pers.`
                      : formaterMontant(f.chiffre_affaires),
                  image: imageDe(
                    couverturesFormations,
                    'formations',
                    f.id_formation,
                    () => imageFormation(f.id_formation)
                  ),
                  lien: `/personnel/formations/${f.id_formation}`,
                  detail: `${f.titre} — ${f.inscrits} inscrit(s), ${formaterMontant(
                    f.chiffre_affaires
                  )}, ${f.nombre_reservations} réservation(s)`,
                })
              )}
            />
          </Panneau>
        </>
      )}
    </section>
  );
}

function Indicateur({
  icone: Icone,
  libelle,
  valeur,
  attention = false,
}: {
  icone: typeof Package;
  libelle: string;
  valeur: string;
  attention?: boolean;
}) {
  return (
    <div
      className={`h-full rounded-2xl border bg-surface p-4 shadow-sm ${
        attention ? 'border-attente/50' : 'border-gris-200'
      }`}
    >
      <div className="flex items-center gap-2 text-sm text-gris-500">
        <Icone
          size={16}
          aria-hidden
          className={attention ? 'text-attente' : 'text-primaire'}
        />
        {libelle}
      </div>
      <p className="mt-2 text-2xl font-bold text-gris-700">{valeur}</p>
    </div>
  );
}

function Panneau({
  titre,
  actions,
  className = '',
  children,
}: {
  titre: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titre}
      className={`rounded-2xl border border-gris-200 bg-surface p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gris-700">{titre}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Couverture déposée par l'administration, ou illustration de repli. */
function imageDe(
  couvertures: Record<string, string>,
  partie: PartieCatalogue,
  id: number,
  repli: () => string
): string {
  const fichier = couvertures[String(id)];
  return fichier === undefined ? repli() : urlPhotoPartie(partie, fichier);
}

function Bascule<T extends string>({
  libelle,
  options,
  choix,
  surChoix,
}: {
  libelle: string;
  options: { valeur: T; libelle: string }[];
  choix: T;
  surChoix: (valeur: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={libelle}
      className="flex gap-1 rounded-xl bg-gris-100 p-1"
    >
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          aria-pressed={choix === option.valeur}
          onClick={() => surChoix(option.valeur)}
          className={`${CLASSES_BASCULE} text-gris-600`}
        >
          {option.libelle}
        </button>
      ))}
    </div>
  );
}
