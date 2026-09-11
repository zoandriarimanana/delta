/**
 * Détail complet de la cible d'une réservation — la partie qu'une cellule de
 * tableau ne peut pas porter (capacité, tarifs, titre…), raison d'être de la
 * fiche (`ReservationDetailAdministrationPage`, cf. sa docstring).
 *
 * Une requête par type de cible, **jamais plusieurs par ligne affichée** :
 * ce composant ne vit que sur la fiche d'une réservation, pas sur la liste —
 * la dette N+1 relevée sur l'historique des commandes ne s'applique donc pas
 * ici.
 */

import { useEffect, useState } from 'react';

import { formaterMontant } from '@/features/commande/commande.service';
import {
  recupererFormation,
  recupererSession,
} from '@/features/formation/formation.api';
import type { Formation } from '@/features/formation/formation.types';
import { recupererLogement } from '@/features/logement/logement.api';
import { libelleStatut as libelleStatutLogement } from '@/features/logement/logement.service';
import type { Logement } from '@/features/logement/logement.types';
import { recupererSalle } from '@/features/salle/salle.api';
import { libelleTarif } from '@/features/salle/salle.service';
import type { Salle } from '@/features/salle/salle.types';

import type { Reservation } from '../reservation.types';

export default function DetailCible({ reservation }: { reservation: Reservation }) {
  switch (reservation.type_reservation) {
    case 'Salle':
      return reservation.id_salle === null ? null : (
        <DetailSalle idSalle={reservation.id_salle} />
      );
    case 'Logement':
      return reservation.id_logement === null ? null : (
        <DetailLogement idLogement={reservation.id_logement} />
      );
    case 'Formation':
      return reservation.id_session === null ? null : (
        <DetailFormation idSession={reservation.id_session} />
      );
    default:
      // `Table` ne porte aucune cible (cf. `reservation.service.ts::libelleCible`).
      return null;
  }
}

function DetailSalle({ idSalle }: { idSalle: number }) {
  const [salle, setSalle] = useState<Salle | null>(null);

  useEffect(() => {
    let actif = true;
    recupererSalle(idSalle).then((donnees) => actif && setSalle(donnees));
    return () => {
      actif = false;
    };
  }, [idSalle]);

  if (salle === null) {
    return null;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="text-sm text-warm-gray-500">Nom</dt>
        <dd className="text-warm-gray-700">{salle.nom}</dd>
      </div>
      <div>
        <dt className="text-sm text-warm-gray-500">Capacité</dt>
        <dd className="text-warm-gray-700">{salle.capacite} personnes</dd>
      </div>
      <div>
        <dt className="text-sm text-warm-gray-500">Tarif</dt>
        <dd className="text-warm-gray-700">{libelleTarif(salle)}</dd>
      </div>
      {salle.equipements !== null && (
        <div>
          <dt className="text-sm text-warm-gray-500">Équipements</dt>
          <dd className="text-warm-gray-700">{salle.equipements}</dd>
        </div>
      )}
    </dl>
  );
}

function DetailLogement({ idLogement }: { idLogement: number }) {
  const [logement, setLogement] = useState<Logement | null>(null);

  useEffect(() => {
    let actif = true;
    recupererLogement(idLogement).then((donnees) => actif && setLogement(donnees));
    return () => {
      actif = false;
    };
  }, [idLogement]);

  if (logement === null) {
    return null;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="text-sm text-warm-gray-500">Type de chambre</dt>
        <dd className="text-warm-gray-700">{logement.type_chambre}</dd>
      </div>
      <div>
        <dt className="text-sm text-warm-gray-500">Capacité</dt>
        <dd className="text-warm-gray-700">{logement.capacite} personnes</dd>
      </div>
      <div>
        <dt className="text-sm text-warm-gray-500">Tarif</dt>
        <dd className="text-warm-gray-700">
          {formaterMontant(logement.tarif_nuitee)} / nuitée
        </dd>
      </div>
      <div>
        <dt className="text-sm text-warm-gray-500">État du bien</dt>
        <dd className="text-warm-gray-700">{libelleStatutLogement(logement.statut)}</dd>
      </div>
    </dl>
  );
}

function DetailFormation({ idSession }: { idSession: number }) {
  const [formation, setFormation] = useState<Formation | null>(null);

  useEffect(() => {
    let actif = true;
    // Deux requêtes séquentielles, pas une : la réservation ne porte que
    // `id_session`, la formation n'est atteignable qu'en passant par la
    // session (cf. `reservation.service.ts::imageCible`, même contrainte).
    async function charger() {
      const session = await recupererSession(idSession);
      const donnees = await recupererFormation(session.id_formation);
      if (actif) {
        setFormation(donnees);
      }
    }
    void charger();
    return () => {
      actif = false;
    };
  }, [idSession]);

  if (formation === null) {
    return null;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="text-sm text-warm-gray-500">Titre</dt>
        <dd className="text-warm-gray-700">{formation.titre}</dd>
      </div>
      {formation.niveau !== null && (
        <div>
          <dt className="text-sm text-warm-gray-500">Niveau</dt>
          <dd className="text-warm-gray-700">{formation.niveau}</dd>
        </div>
      )}
      <div>
        <dt className="text-sm text-warm-gray-500">Durée</dt>
        <dd className="text-warm-gray-700">{formation.duree_heures} heures</dd>
      </div>
      <div>
        <dt className="text-sm text-warm-gray-500">Prix</dt>
        <dd className="text-warm-gray-700">{formaterMontant(formation.prix)}</dd>
      </div>
    </dl>
  );
}
