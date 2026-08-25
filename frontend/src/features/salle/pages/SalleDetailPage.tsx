/**
 * Fiche d'une salle, avec son formulaire de réservation.
 *
 * La page ne connaît rien de l'API de réservation : elle monte un composant du
 * module `reservation/`, qui s'en charge — même mécanique que la fiche de
 * formation (cf. `docs/architecture.md`).
 */

import { Link, useParams } from 'react-router';

import FormulaireReservationCreneau from '@/features/reservation/components/FormulaireReservationCreneau';

import { useSalle } from '../salle.hooks';
import { libelleTarif } from '../salle.service';

export default function SalleDetailPage() {
  const { idSalle } = useParams();
  // Un identifiant illisible désactive la requête plutôt que d'en émettre une
  // vouée à échouer.
  const identifiant = Number(idSalle);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const { donnees, chargement, erreur } = useSalle(valide ? identifiant : null);

  if (!valide || erreur !== null) {
    return (
      <section>
        <p role="alert" className="text-slate-700">
          Cette salle est introuvable.
        </p>
        <Link to="/salles" className="mt-4 inline-block text-slate-900 underline">
          Retour aux salles
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
      <h1 className="text-2xl font-semibold text-slate-900">{donnees.nom}</h1>
      <p className="mt-2 text-slate-700">
        {donnees.capacite} personne(s) — {libelleTarif(donnees)}
      </p>
      {donnees.equipements !== null && (
        <p className="mt-1 text-sm text-slate-600">{donnees.equipements}</p>
      )}

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Réserver</h2>
      <FormulaireReservationCreneau
        cible="Salle"
        idCible={donnees.id_salle}
        capacite={donnees.capacite}
      />

      <Link to="/salles" className="mt-8 inline-block text-slate-900 underline">
        Retour aux salles
      </Link>
    </section>
  );
}
