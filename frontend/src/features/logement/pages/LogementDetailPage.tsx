/**
 * Fiche d'un logement, avec son formulaire de réservation.
 *
 * La page ne connaît rien de l'API de réservation : elle monte un composant du
 * module `reservation/`, qui s'en charge.
 *
 * Le statut du bien conditionne l'affichage du formulaire, sans jamais le
 * garantir : le serveur refuse en 409 un logement non louable, et c'est lui qui
 * fait foi. Masquer le formulaire évite seulement au client de découvrir le
 * refus après avoir saisi ses dates.
 */

import { Link, useParams } from 'react-router';

import { formaterMontant } from '@/features/commande/commande.service';
import FormulaireReservationCreneau from '@/features/reservation/components/FormulaireReservationCreneau';

import { useLogement } from '../logement.hooks';
import { estReservable, libelleStatut } from '../logement.service';

export default function LogementDetailPage() {
  const { idLogement } = useParams();
  const identifiant = Number(idLogement);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const { donnees, chargement, erreur } = useLogement(valide ? identifiant : null);

  if (!valide || erreur !== null) {
    return (
      <section>
        <p role="alert" className="text-slate-700">
          Cet hébergement est introuvable.
        </p>
        <Link to="/logements" className="mt-4 inline-block text-slate-900 underline">
          Retour aux hébergements
        </Link>
      </section>
    );
  }

  if (chargement || donnees === null) {
    return (
      <p role="status" className="text-slate-500">
        Chargement…
      </p>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">{donnees.type_chambre}</h1>
      <p className="mt-2 text-slate-700">
        {donnees.capacite} personne(s) — {formaterMontant(donnees.tarif_nuitee)} / nuit
      </p>
      <p className="mt-1 text-sm text-slate-600">{libelleStatut(donnees.statut)}</p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Réserver</h2>
      <FormulaireReservationCreneau
        cible="Logement"
        idCible={donnees.id_logement}
        capacite={donnees.capacite}
        reservable={estReservable(donnees)}
      />

      <Link to="/logements" className="mt-8 inline-block text-slate-900 underline">
        Retour aux hébergements
      </Link>
    </section>
  );
}
