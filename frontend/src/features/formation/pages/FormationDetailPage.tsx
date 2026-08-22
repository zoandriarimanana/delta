/**
 * Fiche d'une formation et ses sessions.
 *
 * C'est ici que le formulaire de réservation s'insère, session par session. La
 * page ne connaît rien de l'API de réservation : elle monte un composant du
 * module `reservation/`, qui s'en charge.
 */

import { Link, useParams } from 'react-router';

import { formaterMontant } from '@/features/commande/commande.service';

import CarteSession from '../components/CarteSession';
import { formaterDuree } from '../formation.service';
import { useFormation, useSessions } from '../formation.hooks';

export default function FormationDetailPage() {
  const { idFormation } = useParams();
  // Un identifiant illisible désactive les requêtes plutôt que d'en émettre une
  // vouée à échouer.
  const identifiant = Number(idFormation);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const formation = useFormation(valide ? identifiant : null);
  const sessions = useSessions(valide ? identifiant : null);

  if (!valide || formation.erreur !== null) {
    return (
      <section>
        <p role="alert" className="text-slate-700">
          Cette formation est introuvable.
        </p>
        <Link to="/formations" className="mt-4 inline-block text-slate-900 underline">
          Retour au catalogue
        </Link>
      </section>
    );
  }

  if (formation.chargement || formation.donnees === null) {
    return (
      <p role="status" className="text-slate-500">
        Chargement…
      </p>
    );
  }

  const fiche = formation.donnees;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">{fiche.titre}</h1>
      <p className="mt-2 text-slate-700">
        {formaterDuree(fiche.duree_heures)}
        {fiche.niveau !== null && <> — niveau {fiche.niveau}</>}
        {' — '}
        {formaterMontant(fiche.prix)}
      </p>
      {fiche.propose_hebergement && (
        <p className="mt-1 text-sm text-slate-500">
          Un hébergement peut être demandé à la réservation.
        </p>
      )}

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Sessions</h2>

      {sessions.chargement && (
        <p role="status" className="mt-4 text-slate-500">
          Chargement…
        </p>
      )}

      {sessions.erreur !== null && (
        <p role="alert" className="mt-4 text-red-800">
          {sessions.erreur}
        </p>
      )}

      {sessions.donnees !== null && sessions.donnees.length === 0 && (
        <p className="mt-4 text-slate-600">
          Aucune session n’est programmée pour le moment.
        </p>
      )}

      <ul className="mt-4 space-y-4">
        {(sessions.donnees ?? []).map((session) => (
          <CarteSession
            key={session.id_session}
            session={session}
            proposeHebergement={fiche.propose_hebergement}
          />
        ))}
      </ul>

      <Link to="/formations" className="mt-8 inline-block text-slate-900 underline">
        Retour au catalogue
      </Link>
    </section>
  );
}
