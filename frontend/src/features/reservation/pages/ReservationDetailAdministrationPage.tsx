/**
 * Fiche d'une réservation, administration.
 *
 * Complète `AdministrationReservationsPage` (le tableau) : une cellule ne
 * peut pas porter la grande image ni le détail complet de la cible
 * (capacité, tarifs, titre…) — c'est tout l'objet de cette page.
 * `DetailCible` fait la seule requête nécessaire pour l'obtenir, une fois
 * par visite de fiche, jamais une par ligne de tableau.
 *
 * **Mêmes conditions d'affichage des actions que le tableau, au mot près** :
 * `peutMarquerHonoree`/`peutAnnuler` (`reservation.service.ts`) sont
 * partagées entre les deux vues, jamais recalculées ici — même principe que
 * `PersonnelService.obtenir_avec_fonction` côté serveur, une seconde
 * implémentation ne divergerait qu'au jour où l'une serait corrigée sans
 * l'autre.
 */

import { Link, useParams } from 'react-router';
import { Archive, Check, CheckCircle2, RotateCcw, X } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';
import { formaterDate, formaterMontant } from '@/features/commande/commande.service';

import EtatAcompte from '../components/EtatAcompte';
import DetailCible from '../components/DetailCible';
import {
  useActionsReservationAdministration,
  useArchivageReservations,
  useReservationDetailAdministration,
} from '../reservation.administration';
import {
  imageCible,
  libelleCible,
  libelleStatut,
  peutAnnuler,
  peutConfirmer,
  peutMarquerHonoree,
} from '../reservation.service';

export default function ReservationDetailAdministrationPage() {
  const { idReservation } = useParams<{ idReservation: string }>();
  const id = Number(idReservation);

  const detail = useReservationDetailAdministration(id);
  const actions = useActionsReservationAdministration(detail.recharger);
  const archivage = useArchivageReservations(detail.recharger);

  if (detail.chargement) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }

  if (detail.reservation === null) {
    return (
      <p
        role="alert"
        className="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      >
        {detail.erreur ?? 'Réservation introuvable.'}
      </p>
    );
  }

  const reservation = detail.reservation;
  const image = imageCible(reservation);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gris-700">
          Réservation n° {reservation.id_reservation}
        </h1>
        <Link to="/personnel/reservations" className="text-sm text-primaire underline">
          Retour à la liste
        </Link>
      </div>

      {reservation.supprime_le != null && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gris-300 bg-gris-100 p-4">
          <p className="flex items-center gap-2 text-sm text-gris-700">
            <Archive size={16} aria-hidden />
            Réservation supprimée de la liste (archivée). Elle reste conservée avec ses
            paiements et ses avis.
          </p>
          <Bouton
            variante="valider"
            icone={RotateCcw}
            onClick={() => void archivage.restaurer(reservation.id_reservation)}
            disabled={archivage.envoi}
          >
            Restaurer
          </Bouton>
        </div>
      )}

      {archivage.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {archivage.erreur}
        </p>
      )}

      {actions.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {actions.erreur}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
        <div className="flex gap-4">
          {image !== null && (
            <img
              src={image}
              alt=""
              className="h-40 w-40 shrink-0 rounded-lg object-cover"
            />
          )}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gris-500">Client</dt>
              <dd className="text-gris-700">Client n° {reservation.id_client}</dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Type</dt>
              <dd className="text-gris-700">{reservation.type_reservation}</dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Cible</dt>
              <dd className="text-gris-700">{libelleCible(reservation)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Statut</dt>
              <dd className="text-gris-700">
                {libelleStatut(reservation.statut, reservation.type_reservation)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Début</dt>
              <dd className="text-gris-700">{formaterDate(reservation.date_debut)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Fin</dt>
              <dd className="text-gris-700">{formaterDate(reservation.date_fin)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gris-500">Personnes</dt>
              <dd className="text-gris-700">{reservation.nombre_personnes}</dd>
            </div>
            {reservation.montant_total != null && (
              <div>
                <dt className="text-sm text-gris-500">Prix</dt>
                <dd className="text-gris-700">
                  {formaterMontant(reservation.montant_total)}
                </dd>
              </div>
            )}
            {reservation.montant_acompte != null && (
              <div>
                <dt className="text-sm text-gris-500">Acompte (30 %)</dt>
                <dd className="text-gris-700">
                  {formaterMontant(reservation.montant_acompte)} —{' '}
                  <EtatAcompte reservation={reservation} />
                </dd>
              </div>
            )}
            {reservation.avec_hebergement && (
              <div>
                <dt className="text-sm text-gris-500">Hébergement</dt>
                {/* Le drapeau dit un souhait, pas une chambre attribuée — la
                    formulation le reflète (cf. `docs/mld.md`). */}
                <dd className="text-gris-700">
                  {reservation.id_reservation_hebergement !== null
                    ? 'Attribué'
                    : 'Demandé, aucune chambre disponible'}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-4 border-t border-gris-200 pt-4">
          <DetailCible reservation={reservation} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {peutConfirmer(reservation) && (
          <Bouton
            variante="primaire"
            icone={CheckCircle2}
            onClick={() => void actions.confirmer(reservation.id_reservation)}
            disabled={actions.idEnCours === reservation.id_reservation}
          >
            Confirmer la réservation
          </Bouton>
        )}
        {peutMarquerHonoree(reservation) && (
          <Bouton
            variante="valider"
            icone={Check}
            onClick={() => void actions.marquerHonoree(reservation.id_reservation)}
            disabled={actions.idEnCours === reservation.id_reservation}
          >
            Marquer honorée
          </Bouton>
        )}
        {peutAnnuler(reservation) && (
          <Bouton
            variante="danger"
            icone={X}
            onClick={() => void actions.annuler(reservation.id_reservation)}
            disabled={actions.idEnCours === reservation.id_reservation}
          >
            Annuler
          </Bouton>
        )}
      </div>
    </section>
  );
}
