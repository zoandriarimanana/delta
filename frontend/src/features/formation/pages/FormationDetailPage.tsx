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
import { formaterMontant } from '@/features/commande/commande.service';
import GaleriePhotos from '@/features/galerie/components/GaleriePhotos';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import { imagePour } from '@/lib/images';

import CarteSession from '../components/CarteSession';
import { useDomaines, useFormation, useSessions } from '../formation.hooks';
import { formaterDuree, nombreSessionsReservables } from '../formation.service';
import type { Formation, SessionFormation } from '../formation.types';

export default function FormationDetailPage() {
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
        <BoutonRetour vers="/formations">Retour aux formations</BoutonRetour>
        <p role="alert" className="mt-6 text-warm-gray-700">
          Cette formation est introuvable.
        </p>
      </section>
    );
  }

  if (formation.chargement || formation.donnees === null) {
    return (
      <p role="status" className="text-warm-gray-500">
        Chargement…
      </p>
    );
  }

  const fiche = formation.donnees;
  const domaine = domaines.donnees?.find((d) => d.id_domaine === fiche.id_domaine);

  return (
    <section>
      <BoutonRetour vers="/formations">Retour aux formations</BoutonRetour>

      <article className="mt-6 grid gap-8 md:grid-cols-2">
        <GaleriePhotos
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
        <h2 className="text-xl font-semibold text-warm-gray-700">Description</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-warm-gray-600">
          {fiche.description ??
            `Formation de ${formaterDuree(fiche.duree_heures)}` +
              (fiche.niveau !== null ? `, niveau ${fiche.niveau}` : '') +
              `, en groupe de ${fiche.capacite_max} participant(s) au plus. ` +
              'Aucune présentation détaillée n’a encore été rédigée pour ' +
              'cette formation.'}
        </p>
        {domaine?.description != null && (
          <p className="mt-3 text-sm leading-relaxed text-warm-gray-500">
            <span className="font-medium text-warm-gray-600">
              À propos du domaine « {domaine.libelle} » :
            </span>{' '}
            {domaine.description}
          </p>
        )}
      </section>

      <section aria-labelledby="titre-sessions" className="mt-10">
        <h2 id="titre-sessions" className="text-xl font-semibold text-warm-gray-700">
          Sessions et inscriptions
        </h2>

        {sessions.chargement && (
          <p role="status" className="mt-4 text-warm-gray-500">
            Chargement…
          </p>
        )}

        {sessions.erreur !== null && (
          <p role="alert" className="mt-4 text-terracotta">
            {sessions.erreur}
          </p>
        )}

        {sessions.donnees !== null && sessions.donnees.length === 0 && (
          <p className="mt-4 rounded-xl border border-warm-gray-200 bg-white p-4 text-warm-gray-600">
            Aucune session n’est programmée pour le moment. Revenez prochainement : les
            nouvelles dates sont annoncées ici dès leur planification.
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
  const ouvertes = sessions === null ? null : nombreSessionsReservables(sessions);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-terracotta">
          {domaine ?? 'Formation'}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-warm-gray-700">
          {formation.titre}
        </h1>
        <div className="mt-2">
          <NoteMoyenne
            moyenne={formation.note_moyenne}
            nombre={formation.nombre_avis}
          />
        </div>
      </div>

      <p className="text-2xl font-bold text-terracotta">
        {formaterMontant(formation.prix)}{' '}
        <span className="text-base font-medium text-warm-gray-500">par personne</span>
      </p>

      {/* Le module choisit ses libellés et ses variantes : la pastille ne
          connaît pas la formation. */}
      <ul aria-label="Statuts de la formation" className="flex flex-wrap gap-2">
        {ouvertes !== null && (
          <li>
            <Badge variante={ouvertes > 0 ? 'positif' : 'attente'}>
              {ouvertes > 0
                ? `${ouvertes} session(s) ouverte(s)`
                : 'Aucune inscription ouverte'}
            </Badge>
          </li>
        )}
        {formation.niveau !== null && (
          <li>
            <Badge>Niveau {formation.niveau}</Badge>
          </li>
        )}
        <li>
          <Badge>{formaterDuree(formation.duree_heures)}</Badge>
        </li>
        {formation.propose_hebergement && (
          <li>
            <Badge variante="attente">Hébergement possible</Badge>
          </li>
        )}
      </ul>

      <div
        className={`rounded-xl border p-4 ${
          ouvertes !== null && ouvertes > 0
            ? 'border-sage/30 bg-sage/10'
            : 'border-amber/30 bg-amber/10'
        }`}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray-600">
          Inscription
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-gray-600">
          {ouvertes !== null && ouvertes > 0
            ? 'Des places sont disponibles. Choisissez votre session plus bas : ' +
              'votre place est retenue dès l’envoi de la demande.'
            : 'Aucune session n’accepte d’inscription pour le moment. Les ' +
              'prochaines dates apparaîtront plus bas dès leur ouverture.'}{' '}
          {formation.propose_hebergement
            ? 'Un hébergement sur place peut être demandé à la réservation : une ' +
              'chambre libre vous est alors attribuée pour les dates de la session.'
            : 'Cette formation ne comprend pas d’hébergement.'}
        </p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-warm-gray-200 bg-white p-4 text-sm">
        <Ligne terme="Durée" valeur={formaterDuree(formation.duree_heures)} />
        <Ligne terme="Niveau" valeur={formation.niveau ?? 'Tous niveaux'} />
        <Ligne
          terme="Groupe"
          valeur={`${formation.capacite_max} participant(s) au plus`}
        />
        <Ligne
          terme="Hébergement"
          valeur={formation.propose_hebergement ? 'Possible sur demande' : 'Non inclus'}
        />
      </dl>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-warm-gray-500">{terme}</dt>
      <dd className="text-right font-medium text-warm-gray-700">{valeur}</dd>
    </div>
  );
}
