/**
 * Fiche d'une formation : galerie, présentation, sessions.
 *
 * C'est ici que le formulaire de réservation s'insère, session par session. La
 * page ne connaît rien des API de réservation ni de galerie : elle monte un
 * composant de chaque module, qui s'en charge (cf. `docs/architecture.md`,
 * « Réserver n'est pas consulter »).
 */

import { useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import BoutonRetour from '@/components/ui/BoutonRetour';
import NoteMoyenne from '@/components/ui/NoteMoyenne';
import { useFormaterPrix } from '@/features/devise/devise.hooks';
import GaleriePhotos from '@/features/galerie/components/GaleriePhotos';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import { imagePour } from '@/lib/images';
import { useTextes } from '@/lib/langue';

import { TEXTES_FORMATION } from '../formation.textes';
import CarteSession from '../components/CarteSession';
import { useDomaines, useFormation, useSessions } from '../formation.hooks';
import { formaterDuree, nombreSessionsReservables } from '../formation.service';
import type { Formation, SessionFormation } from '../formation.types';

export default function FormationDetailPage() {
  const t = useTextes(TEXTES_FORMATION);
  const { idFormation } = useParams();
  // Un identifiant illisible désactive les requêtes plutôt que d'en émettre une
  // vouée à échouer.
  const identifiant = Number(idFormation);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const formation = useFormation(valide ? identifiant : null);
  const sessions = useSessions(valide ? identifiant : null);
  const domaines = useDomaines();
  const galerie = useGalerie(valide ? { formation: identifiant } : null);

  if (!valide || formation.erreur !== null) {
    return (
      <section>
        <BoutonRetour vers="/formations">{t.retour}</BoutonRetour>
        <p role="alert" className="mt-6 text-gris-700">
          {t.introuvable}
        </p>
      </section>
    );
  }

  if (formation.chargement || formation.donnees === null) {
    return (
      <p role="status" className="text-gris-500">
        {t.chargement}
      </p>
    );
  }

  const fiche = formation.donnees;
  const domaine = domaines.donnees?.find((d) => d.id_domaine === fiche.id_domaine);

  return (
    <section>
      <BoutonRetour vers="/formations">{t.retour}</BoutonRetour>

      <article className="mt-6 grid gap-8 md:grid-cols-2">
        <GaleriePhotos
          bien={{ formation: fiche.id_formation }}
          photos={galerie.photos}
          repli={imagePour('formation', fiche.id_formation, 900)}
          nomBien={fiche.titre}
        />
        <Presentation
          formation={fiche}
          domaine={domaine?.libelle}
          sessions={sessions.donnees}
        />
      </article>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gris-700">{t.description}</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-gris-600">
          {fiche.description ??
            t.descriptionParDefaut(
              formaterDuree(fiche.duree_heures),
              fiche.niveau,
              fiche.capacite_max
            )}
        </p>
        {domaine?.description != null && (
          <p className="mt-3 text-sm leading-relaxed text-gris-500">
            <span className="font-medium text-gris-600">
              {t.aProposDomaine(domaine.libelle)}
            </span>{' '}
            {domaine.description}
          </p>
        )}
      </section>

      <section aria-labelledby="titre-sessions" className="mt-10">
        <h2 id="titre-sessions" className="text-xl font-semibold text-gris-700">
          {t.sessionsInscriptions}
        </h2>

        {sessions.chargement && (
          <p role="status" className="mt-4 text-gris-500">
            {t.chargement}
          </p>
        )}

        {sessions.erreur !== null && (
          <p role="alert" className="mt-4 text-danger">
            {sessions.erreur}
          </p>
        )}

        {sessions.donnees !== null && sessions.donnees.length === 0 && (
          <p className="mt-4 rounded-xl border border-gris-200 bg-surface p-4 text-gris-600">
            {t.aucuneSession}
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
      </section>
    </section>
  );
}

function Presentation({
  formation,
  domaine,
  sessions,
}: {
  formation: Formation;
  domaine: string | undefined;
  sessions: SessionFormation[] | null;
}) {
  const t = useTextes(TEXTES_FORMATION);
  const prix = useFormaterPrix();
  const ouvertes = sessions === null ? null : nombreSessionsReservables(sessions);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primaire">
          {domaine ?? t.formation}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-gris-700">{formation.titre}</h1>
        <div className="mt-2">
          <NoteMoyenne
            moyenne={formation.note_moyenne}
            nombre={formation.nombre_avis}
          />
        </div>
      </div>

      <p className="text-2xl font-bold text-primaire">
        {prix(formation.prix)}{' '}
        <span className="text-base font-medium text-gris-500">{t.parPersonne}</span>
      </p>

      {/* Le module choisit ses libellés et ses variantes : la pastille ne
          connaît pas la formation. */}
      <ul aria-label={t.statutsFormation} className="flex flex-wrap gap-2">
        {ouvertes !== null && (
          <li>
            <Badge variante={ouvertes > 0 ? 'positif' : 'attente'}>
              {ouvertes > 0 ? t.sessionsOuvertes(ouvertes) : t.aucuneInscription}
            </Badge>
          </li>
        )}
        {formation.niveau !== null && (
          <li>
            <Badge>{t.niveau(formation.niveau)}</Badge>
          </li>
        )}
        <li>
          <Badge>{formaterDuree(formation.duree_heures)}</Badge>
        </li>
        {formation.propose_hebergement && (
          <li>
            <Badge variante="attente">{t.hebergementPossible}</Badge>
          </li>
        )}
      </ul>

      <div
        className={`rounded-xl border p-4 ${
          ouvertes !== null && ouvertes > 0
            ? 'border-succes/30 bg-succes/10'
            : 'border-attente/30 bg-attente/10'
        }`}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gris-600">
          {t.inscription}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gris-600">
          {ouvertes !== null && ouvertes > 0
            ? t.placesDisponibles
            : t.aucuneSessionOuverte}{' '}
          {formation.propose_hebergement ? t.avecHebergement : t.sansHebergement}
        </p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-gris-200 bg-surface p-4 text-sm">
        <Ligne terme={t.duree} valeur={formaterDuree(formation.duree_heures)} />
        <Ligne terme={t.niveauTerme} valeur={formation.niveau ?? t.tousNiveaux} />
        <Ligne terme={t.groupe} valeur={t.participantsMax(formation.capacite_max)} />
        <Ligne
          terme={t.hebergementTerme}
          valeur={formation.propose_hebergement ? t.surDemande : t.nonInclus}
        />
      </dl>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gris-500">{terme}</dt>
      <dd className="text-right font-medium text-gris-700">{valeur}</dd>
    </div>
  );
}
