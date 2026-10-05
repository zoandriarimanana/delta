/**
 * Fiche d'un logement : galerie, présentation, statut expliqué, réservation.
 *
 * La page ne connaît rien des API de réservation ni de galerie : elle monte un
 * composant de chaque module, qui s'en charge.
 *
 * Le statut du bien conditionne l'affichage du formulaire, sans jamais le
 * garantir : le serveur refuse en 409 un logement non louable, et c'est lui qui
 * fait foi. Masquer le formulaire évite seulement au client de découvrir le
 * refus après avoir saisi ses dates.
 */

import { useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import BoutonRetour from '@/components/ui/BoutonRetour';
import NoteMoyenne from '@/components/ui/NoteMoyenne';
import { formaterMontant } from '@/features/commande/commande.service';
import GaleriePhotos from '@/features/galerie/components/GaleriePhotos';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import FormulaireReservationCreneau from '@/features/reservation/components/FormulaireReservationCreneau';
import { imagePour } from '@/lib/images';

import { useLogement } from '../logement.hooks';
import {
  estReservable,
  explicationStatut,
  libelleStatut,
  varianteStatut,
} from '../logement.service';
import type { Logement } from '../logement.types';

export default function LogementDetailPage() {
  const { idLogement } = useParams();
  const identifiant = Number(idLogement);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const { donnees, chargement, erreur } = useLogement(valide ? identifiant : null);
  const galerie = useGalerie(valide ? { logement: identifiant } : null);

  if (!valide || erreur !== null) {
    return (
      <section>
        <BoutonRetour vers="/logements">Retour aux hébergements</BoutonRetour>
        <p role="alert" className="mt-6 text-warm-gray-700">
          Cet hébergement est introuvable.
        </p>
      </section>
    );
  }

  if (chargement || donnees === null) {
    return (
      <p role="status" className="text-warm-gray-500">
        Chargement…
      </p>
    );
  }

  return (
    <section>
      <BoutonRetour vers="/logements">Retour aux hébergements</BoutonRetour>

      <article className="mt-6 grid gap-8 md:grid-cols-2">
        <GaleriePhotos
          bien={{ logement: donnees.id_logement }}
          photos={galerie.photos}
          repli={imagePour('logement', donnees.id_logement, 900)}
          nomBien={`Chambre ${donnees.type_chambre}`}
        />
        <Presentation logement={donnees} />
      </article>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-warm-gray-700">Description</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-warm-gray-600">
          {donnees.description ??
            `Chambre ${donnees.type_chambre} pour ${donnees.capacite} ` +
              'personne(s). Aucune présentation détaillée n’a encore été ' +
              'rédigée pour ce logement.'}
        </p>
      </section>

      <section
        aria-labelledby="titre-reserver"
        className="mt-10 rounded-2xl border border-warm-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 id="titre-reserver" className="text-xl font-semibold text-warm-gray-700">
          Réserver ce logement
        </h2>
        <FormulaireReservationCreneau
          cible="Logement"
          idCible={donnees.id_logement}
          capacite={donnees.capacite}
          reservable={estReservable(donnees)}
        />
      </section>
    </section>
  );
}

function Presentation({ logement }: { logement: Logement }) {
  const variante = varianteStatut(logement.statut);
  // Le cadre du statut reprend l'intention de la pastille : vert si l'on peut
  // réserver, ambre si le bien revient, terracotta s'il est retiré.
  const cadre =
    variante === 'positif'
      ? 'border-sage/30 bg-sage/10'
      : variante === 'attente'
        ? 'border-amber/30 bg-amber/10'
        : 'border-terracotta/30 bg-terracotta/10';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-terracotta">
          Hébergement
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-warm-gray-700">
          Chambre {logement.type_chambre}
        </h1>
        <div className="mt-2">
          <NoteMoyenne moyenne={logement.note_moyenne} nombre={logement.nombre_avis} />
        </div>
      </div>

      <p className="text-2xl font-bold text-terracotta">
        {formaterMontant(logement.tarif_nuitee)} / nuit
      </p>

      <ul aria-label="Statuts du logement" className="flex flex-wrap gap-2">
        <li>
          <Badge variante={variante}>{libelleStatut(logement.statut)}</Badge>
        </li>
        <li>
          <Badge>Jusqu’à {logement.capacite} personne(s)</Badge>
        </li>
      </ul>

      <div className={`rounded-xl border p-4 ${cadre}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray-600">
          Statut : {libelleStatut(logement.statut)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-gray-600">
          {explicationStatut(logement.statut)}
        </p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-warm-gray-200 bg-white p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-warm-gray-500">Type de chambre</dt>
          <dd className="text-right font-medium text-warm-gray-700">
            {logement.type_chambre}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-warm-gray-500">Capacité</dt>
          <dd className="text-right font-medium text-warm-gray-700">
            {logement.capacite} personne(s)
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-warm-gray-500">Tarif</dt>
          <dd className="text-right font-medium text-warm-gray-700">
            {formaterMontant(logement.tarif_nuitee)} par nuit
          </dd>
        </div>
      </dl>
    </div>
  );
}
