/**
 * Administration des commandes, tous clients confondus (Sprint 10.6).
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur.
 *
 * **Liste + fiche**, contrairement à `AdministrationReservationsPage`
 * (une seule page, actions en ligne) : les trois actions d'une commande
 * (annuler, relancer une livraison, marquer remboursée) ne sont pas de
 * simples transitions de statut interchangeables — chacune a ses propres
 * conditions d'apparition, et les regrouper en ligne aurait produit un
 * tableau illisible. C'est le même choix que PERSONNEL et ABONNEMENT.
 *
 * En tête, des **compteurs par étape**, cliquables : ce qui attend une
 * décision (« À confirmer ») se voit avant de lire le tableau, et ces lignes
 * sont surlignées en ambre. Une recherche couvre numéro, client, invité,
 * contact et produits.
 *
 * Le filtre par statut est **côté client** : `GET /commandes/administration`
 * ne porte aucun paramètre de filtre (cf. `commande.api.ts`).
 *
 * **Panneau « Abonnements » et panneau « Réservations » : de simples liens**
 * vers les écrans déjà livrés (7.3 et 10.3), pas une nouvelle page agrégée —
 * décision actée dans le scope de cette tâche. Un tableau de bord commun aux
 * trois domaines resterait à construire le jour où le besoin se manifeste.
 */

import { useMemo, useState } from 'react';
import { CalendarCheck, ClipboardList, Repeat, Search } from 'lucide-react';
import { Link } from 'react-router';

import LigneCommandeAdministration from '../components/LigneCommandeAdministration';
import { estTerminee, libelleStatutCommande } from '../commande.service';
import { useCommandesAdministration } from '../commande.administration';
import type { Commande, StatutCommande } from '../commande.types';

const STATUTS: StatutCommande[] = [
  'En_attente',
  'Confirmee',
  'En_preparation',
  'Livree',
  'Servie',
  'Annulee',
];

type Groupe = '' | 'attente' | 'cours' | 'terminee' | 'annulee' | 'remboursee';

/** Groupe d'une commande pour les compteurs — une même lecture que la pastille. */
function dansGroupe(commande: Commande, groupe: Groupe): boolean {
  switch (groupe) {
    case '':
      return true;
    case 'attente':
      return commande.statut === 'En_attente';
    case 'cours':
      return (
        commande.statut !== 'En_attente' &&
        commande.statut !== 'Annulee' &&
        !estTerminee(commande)
      );
    case 'terminee':
      return commande.statut !== 'Annulee' && estTerminee(commande);
    case 'annulee':
      return commande.statut === 'Annulee';
    case 'remboursee':
      return commande.rembourse_le !== null;
  }
}

const COMPTEURS: { groupe: Groupe; libelle: string; teinte: string }[] = [
  { groupe: '', libelle: 'Toutes', teinte: 'border-gris-300 text-gris-700' },
  { groupe: 'attente', libelle: 'À confirmer', teinte: 'border-attente text-attente' },
  { groupe: 'cours', libelle: 'En cours', teinte: 'border-primaire text-primaire' },
  { groupe: 'terminee', libelle: 'Terminées', teinte: 'border-succes text-succes' },
  { groupe: 'annulee', libelle: 'Annulées', teinte: 'border-danger text-danger' },
  {
    groupe: 'remboursee',
    libelle: 'Remboursées',
    teinte: 'border-attente text-attente',
  },
];

const CLASSES_CHAMP =
  'rounded-lg border border-gris-300 bg-surface px-3 py-2 text-sm text-gris-700 focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20';

export default function AdministrationCommandesPage() {
  const donnees = useCommandesAdministration();
  const [filtreStatut, setFiltreStatut] = useState<StatutCommande | ''>('');
  const [groupe, setGroupe] = useState<Groupe>('');
  const [recherche, setRecherche] = useState('');

  const compte = useMemo(() => {
    const total = {} as Record<Groupe, number>;
    for (const { groupe: g } of COMPTEURS) {
      total[g] = donnees.commandes.filter((c) => dansGroupe(c, g)).length;
    }
    return total;
  }, [donnees.commandes]);

  const commandesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return donnees.commandes.filter((c) => {
      if (filtreStatut !== '' && c.statut !== filtreStatut) return false;
      if (!dansGroupe(c, groupe)) return false;
      if (terme === '') return true;
      return [
        `${c.id_commande}`,
        c.id_client !== null ? `client n° ${c.id_client}` : '',
        c.nom_invite ?? '',
        c.contact_invite ?? '',
        ...c.lignes.map((l) => l.nom_produit),
      ]
        .join(' ')
        .toLowerCase()
        .includes(terme);
    });
  }, [donnees.commandes, filtreStatut, groupe, recherche]);

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
            <ClipboardList size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-gris-700">
              Administration des commandes
            </h1>
            <p className="mt-0.5 text-sm text-gris-500">
              Toutes les commandes, clients inscrits et invités. Ouvrez une commande
              pour l’annuler, relancer sa livraison ou la marquer remboursée.
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/personnel/abonnements"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gris-300 bg-surface px-3 py-2 font-medium text-gris-700 no-underline hover:border-primaire hover:text-primaire"
          >
            <Repeat size={15} aria-hidden />
            Voir les abonnements
          </Link>
          <Link
            to="/personnel/reservations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gris-300 bg-surface px-3 py-2 font-medium text-gris-700 no-underline hover:border-primaire hover:text-primaire"
          >
            <CalendarCheck size={15} aria-hidden />
            Voir les réservations
          </Link>
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COMPTEURS.map(({ groupe: g, libelle, teinte }) => {
          const actif = groupe === g;
          return (
            <button
              key={g || 'toutes'}
              type="button"
              aria-pressed={actif}
              onClick={() => {
                setGroupe(g);
                setFiltreStatut('');
              }}
              className={`rounded-xl border-l-4 bg-surface px-4 py-3 text-left shadow-sm transition ${teinte} ${
                actif ? 'ring-2 ring-primaire/40' : 'hover:shadow-md'
              }`}
            >
              <span className="block text-2xl font-bold">{compte[g]}</span>
              <span className="block text-xs font-medium text-gris-600">{libelle}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Rechercher</span>
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris-400"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un n°, un client, un invité, un produit…"
            className={`${CLASSES_CHAMP} w-full pl-9`}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gris-500">
          Statut
          <select
            value={filtreStatut}
            onChange={(e) => {
              setFiltreStatut(e.target.value as StatutCommande | '');
              setGroupe('');
            }}
            className={CLASSES_CHAMP}
          >
            <option value="">Tous</option>
            {STATUTS.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleStatutCommande(valeur)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {donnees.erreur}
        </p>
      )}

      {donnees.chargement && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      {!donnees.chargement && commandesFiltrees.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-gris-300 bg-surface p-8 text-center text-gris-500">
          Aucune commande à afficher.
        </p>
      )}

      {commandesFiltrees.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-gris-200 bg-surface shadow-sm">
          <table className="w-full min-w-[52rem] border-collapse">
            <thead className="bg-gris-100">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gris-500">
                <th className="px-3 py-3 pl-4">Commande</th>
                <th className="px-2.5 py-3">Articles</th>
                <th className="px-2.5 py-3">Client</th>
                <th className="px-2.5 py-3">Réception</th>
                <th className="px-2.5 py-3 text-right">Montant</th>
                <th className="px-2.5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-200">
              {commandesFiltrees.map((commande) => (
                <LigneCommandeAdministration
                  key={commande.id_commande}
                  commande={commande}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
