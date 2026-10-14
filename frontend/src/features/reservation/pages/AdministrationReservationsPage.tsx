/**
 * Administration des réservations, les 4 types confondus.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée
 * côté serveur.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, comme
 * `AdministrationPersonnelPage`. Les deux actions (`Marquer honorée`,
 * `Annuler`) restent **aussi** disponibles en ligne, pour l'action rapide —
 * une fiche existe désormais (`ReservationDetailAdministrationPage`, lien
 * « Voir le détail ») pour le détail complet de la cible (image, capacité,
 * tarifs…), qu'une cellule de tableau ne peut pas porter. Les deux vues
 * partagent la même condition d'affichage des actions
 * (`peutMarquerHonoree`/`peutAnnuler`, `reservation.service.ts`) — jamais
 * recalculée deux fois.
 *
 * En tête, un **compteur par statut**, cliquable : ce qui attend une
 * décision (« En attente ») se voit avant même de lire le tableau, et ces
 * lignes sont surlignées en ambre. Couleurs des actions par intention (vert
 * pour honorer, rouge pour annuler) — voir `LigneReservationAdministration`.
 *
 * Le filtre type/statut/recherche est **côté client** : `GET
 * /reservations/administration` ne porte aucun paramètre de filtre
 * (cf. `reservation.api.ts`).
 */

import { useMemo, useState } from 'react';
import { CalendarCheck, Search } from 'lucide-react';

import LigneReservationAdministration from '../components/LigneReservationAdministration';
import {
  useActionsReservationAdministration,
  useArchivageReservations,
  useReservationsAdministration,
} from '../reservation.administration';
import { cleCible, useCiblesResolues } from '../reservation.cibles';
import {
  estArchivee,
  libelleCible,
  libelleStatut,
  libelleType,
} from '../reservation.service';
import type { StatutReservation, TypeReservation } from '../reservation.types';

const TYPES: TypeReservation[] = ['Formation', 'Salle', 'Logement', 'Table'];
const STATUTS: StatutReservation[] = ['En_attente', 'Confirmee', 'Honoree', 'Annulee'];

/** Teinte de chaque compteur : la même lecture que la pastille de statut. */
const TEINTES: Record<StatutReservation | '', string> = {
  '': 'border-gris-300 text-gris-700',
  En_attente: 'border-attente text-attente',
  Confirmee: 'border-primaire text-primaire',
  Honoree: 'border-succes text-succes',
  Annulee: 'border-danger text-danger',
};

const COMPTEURS: { statut: StatutReservation | ''; libelle: string }[] = [
  { statut: '', libelle: 'Toutes' },
  { statut: 'En_attente', libelle: 'À confirmer' },
  { statut: 'Confirmee', libelle: 'Confirmées' },
  { statut: 'Honoree', libelle: 'Honorées' },
  { statut: 'Annulee', libelle: 'Annulées' },
];

const CLASSES_CHAMP =
  'rounded-lg border border-gris-300 bg-surface px-3 py-2 text-sm text-gris-700 focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20';

export default function AdministrationReservationsPage() {
  const [archives, setArchives] = useState(false);
  const donnees = useReservationsAdministration(archives);
  const actions = useActionsReservationAdministration(donnees.recharger);
  const archivage = useArchivageReservations(donnees.recharger);
  const cibles = useCiblesResolues(donnees.reservations);
  const [filtreType, setFiltreType] = useState<TypeReservation | ''>('');
  const [filtreStatut, setFiltreStatut] = useState<StatutReservation | ''>('');
  const [recherche, setRecherche] = useState('');

  const compte = useMemo(() => {
    // Les compteurs ne comptent que les réservations actives : une archive
    // n'attend plus rien.
    const actives = donnees.reservations.filter((r) => !estArchivee(r));
    const total: Record<StatutReservation | '', number> = {
      '': actives.length,
      En_attente: 0,
      Confirmee: 0,
      Honoree: 0,
      Annulee: 0,
    };
    for (const r of actives) total[r.statut] += 1;
    return total;
  }, [donnees.reservations]);

  const reservationsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return donnees.reservations.filter((r) => {
      if (filtreType !== '' && r.type_reservation !== filtreType) return false;
      if (filtreStatut !== '' && r.statut !== filtreStatut) return false;
      if (terme === '') return true;
      const nom = cibles.get(cleCible(r))?.nom ?? libelleCible(r);
      return [nom, `client n° ${r.id_client}`, `${r.id_client}`, `${r.id_reservation}`]
        .join(' ')
        .toLowerCase()
        .includes(terme);
    });
  }, [donnees.reservations, filtreType, filtreStatut, recherche, cibles]);

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
          <CalendarCheck size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gris-700">
            Administration des réservations
          </h1>
          <p className="mt-0.5 text-sm text-gris-500">
            Formations, salles, hébergements et tables, les plus récentes d’abord.
            Confirmez une réservation en attente, marquez-la honorée une fois la
            prestation réalisée, ou annulez-la. Une réservation honorée ou annulée se
            supprime de la liste (corbeille), et se restaure depuis les archives.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COMPTEURS.map(({ statut, libelle }) => {
          const actif = filtreStatut === statut;
          return (
            <button
              key={statut || 'toutes'}
              type="button"
              aria-pressed={actif}
              onClick={() => setFiltreStatut(statut)}
              className={`rounded-xl border-l-4 bg-surface px-4 py-3 text-left shadow-sm transition ${
                TEINTES[statut]
              } ${actif ? 'ring-2 ring-primaire/40' : 'hover:shadow-md'}`}
            >
              <span className="block text-2xl font-bold">{compte[statut]}</span>
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
            placeholder="Rechercher un client, une salle, une formation…"
            className={`${CLASSES_CHAMP} w-full pl-9`}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gris-500">
          Type
          <select
            value={filtreType}
            onChange={(e) => setFiltreType(e.target.value as TypeReservation | '')}
            className={CLASSES_CHAMP}
          >
            <option value="">Tous</option>
            {TYPES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleType(valeur)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gris-500">
          Statut
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as StatutReservation | '')}
            className={CLASSES_CHAMP}
          >
            <option value="">Tous</option>
            {STATUTS.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleStatut(valeur)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-sm text-gris-600">
        <input
          type="checkbox"
          checked={archives}
          onChange={(e) => setArchives(e.target.checked)}
          className="h-4 w-4 rounded border-gris-300"
        />
        Afficher les archives
      </label>

      {archivage.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {archivage.erreur}
        </p>
      )}

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {donnees.erreur}
        </p>
      )}

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {actions.erreur}
        </p>
      )}

      {donnees.chargement && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      {!donnees.chargement && reservationsFiltrees.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-gris-300 bg-surface p-8 text-center text-gris-500">
          Aucune réservation à afficher.
        </p>
      )}

      {reservationsFiltrees.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-gris-200 bg-surface shadow-sm">
          <table className="w-full min-w-[56rem] border-collapse">
            <thead className="bg-gris-100">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gris-500">
                <th className="px-3 py-3 pl-4">Réservation</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Période</th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-200">
              {reservationsFiltrees.map((reservation) => (
                <LigneReservationAdministration
                  key={reservation.id_reservation}
                  reservation={reservation}
                  cible={cibles.get(cleCible(reservation))}
                  enCours={actions.idEnCours === reservation.id_reservation}
                  confirmer={() => void actions.confirmer(reservation.id_reservation)}
                  marquerHonoree={() =>
                    void actions.marquerHonoree(reservation.id_reservation)
                  }
                  annuler={() => void actions.annuler(reservation.id_reservation)}
                  surArchiver={() =>
                    void archivage.archiver(reservation.id_reservation)
                  }
                  surRestaurer={() =>
                    void archivage.restaurer(reservation.id_reservation)
                  }
                  envoiArchivage={archivage.envoi}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
