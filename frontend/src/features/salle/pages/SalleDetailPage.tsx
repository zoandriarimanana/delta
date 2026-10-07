/**
 * Fiche d'une salle : galerie, présentation, conditions, réservation.
 *
 * La page ne connaît rien des API de réservation ni de galerie : elle monte un
 * composant de chaque module, qui s'en charge — même mécanique que la fiche de
 * formation (cf. `docs/architecture.md`, « Réserver n'est pas consulter »).
 */

import { useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import BoutonRetour from '@/components/ui/BoutonRetour';
import NoteMoyenne from '@/components/ui/NoteMoyenne';
import GaleriePhotos from '@/features/galerie/components/GaleriePhotos';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import FormulaireReservationCreneau from '@/features/reservation/components/FormulaireReservationCreneau';
import { imagePour } from '@/lib/images';

import { useSalle } from '../salle.hooks';
import {
  explicationLocation,
  libelleTarif,
  listeEquipements,
  modesLocation,
} from '../salle.service';
import type { Salle } from '../salle.types';

export default function SalleDetailPage() {
  const { idSalle } = useParams();
  // Un identifiant illisible désactive la requête plutôt que d'en émettre une
  // vouée à échouer.
  const identifiant = Number(idSalle);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const { donnees, chargement, erreur } = useSalle(valide ? identifiant : null);
  const galerie = useGalerie(valide ? { salle: identifiant } : null);

  if (!valide || erreur !== null) {
    return (
      <section>
        <BoutonRetour vers="/salles">Retour aux salles</BoutonRetour>
        <p role="alert" className="mt-6 text-gris-700">
          Cette salle est introuvable.
        </p>
      </section>
    );
  }

  if (chargement || donnees === null) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }

  return (
    <section>
      <BoutonRetour vers="/salles">Retour aux salles</BoutonRetour>

      <article className="mt-6 grid gap-8 md:grid-cols-2">
        <GaleriePhotos
          bien={{ salle: donnees.id_salle }}
          photos={galerie.photos}
          repli={imagePour('salle', donnees.id_salle, 900)}
          nomBien={donnees.nom}
        />
        <Presentation salle={donnees} />
      </article>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gris-700">Description</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-gris-600">
          {donnees.description ??
            `${donnees.nom} peut accueillir jusqu’à ${donnees.capacite} ` +
              'personne(s). Aucune présentation détaillée n’a encore été ' +
              'rédigée pour ce lieu.'}
        </p>
      </section>

      <section
        aria-labelledby="titre-reserver"
        className="mt-10 rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm"
      >
        <h2 id="titre-reserver" className="text-xl font-semibold text-gris-700">
          Réserver cette salle
        </h2>
        <FormulaireReservationCreneau
          cible="Salle"
          idCible={donnees.id_salle}
          capacite={donnees.capacite}
        />
      </section>
    </section>
  );
}

function Presentation({ salle }: { salle: Salle }) {
  const equipements = listeEquipements(salle);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primaire">
          Salle à louer
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-gris-700">{salle.nom}</h1>
        <div className="mt-2">
          <NoteMoyenne moyenne={salle.note_moyenne} nombre={salle.nombre_avis} />
        </div>
      </div>

      <p className="text-2xl font-bold text-primaire">{libelleTarif(salle)}</p>

      {/* Le module choisit ses libellés et ses variantes : la pastille ne
          connaît pas la salle. Aucune pastille « libre » : la disponibilité
          d'un créneau ne se lit qu'à la réservation. */}
      <ul aria-label="Statuts de la salle" className="flex flex-wrap gap-2">
        <li>
          <Badge variante="positif">Réservable</Badge>
        </li>
        <li>
          <Badge>Jusqu’à {salle.capacite} personne(s)</Badge>
        </li>
        {modesLocation(salle).map((mode) => (
          <li key={mode}>
            <Badge variante="attente">{mode}</Badge>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-succes/30 bg-succes/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-succes">
          Conditions de location
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gris-600">
          {explicationLocation(salle)}
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gris-500">
          Équipements
        </h2>
        {equipements.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {equipements.map((equipement) => (
              <li
                key={equipement}
                className="rounded-lg border border-gris-200 bg-surface px-3 py-1 text-sm text-gris-700"
              >
                {equipement}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gris-500">
            Aucun équipement particulier n’est renseigné.
          </p>
        )}
      </div>
    </div>
  );
}
