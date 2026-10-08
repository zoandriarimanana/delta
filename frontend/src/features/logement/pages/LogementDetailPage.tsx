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
import { useFormaterPrix } from '@/features/devise/devise.hooks';
import GaleriePhotos from '@/features/galerie/components/GaleriePhotos';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import FormulaireReservationCreneau from '@/features/reservation/components/FormulaireReservationCreneau';
import { imagePour } from '@/lib/images';
import { useTextes } from '@/lib/langue';

import { TEXTES_LOGEMENT } from '../logement.textes';
import { useLogement } from '../logement.hooks';
import {
  estReservable,
  explicationStatut,
  libelleStatut,
  varianteStatut,
} from '../logement.service';
import type { Logement } from '../logement.types';

export default function LogementDetailPage() {
  const t = useTextes(TEXTES_LOGEMENT);
  const { idLogement } = useParams();
  const identifiant = Number(idLogement);
  const valide = Number.isInteger(identifiant) && identifiant > 0;

  const { donnees, chargement, erreur } = useLogement(valide ? identifiant : null);
  const galerie = useGalerie(valide ? { logement: identifiant } : null);

  if (!valide || erreur !== null) {
    return (
      <section>
        <BoutonRetour vers="/logements">{t.retour}</BoutonRetour>
        <p role="alert" className="mt-6 text-gris-700">
          {t.introuvable}
        </p>
      </section>
    );
  }

  if (chargement || donnees === null) {
    return (
      <p role="status" className="text-gris-500">
        {t.chargementCourt}
      </p>
    );
  }

  return (
    <section>
      <BoutonRetour vers="/logements">{t.retour}</BoutonRetour>

      <article className="mt-6 grid gap-8 md:grid-cols-2">
        <GaleriePhotos
          bien={{ logement: donnees.id_logement }}
          photos={galerie.photos}
          repli={imagePour('logement', donnees.id_logement, 900)}
          nomBien={t.chambre(donnees.type_chambre)}
        />
        <Presentation logement={donnees} />
      </article>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gris-700">{t.description}</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-gris-600">
          {donnees.description ??
            t.descriptionParDefaut(donnees.type_chambre, donnees.capacite)}
        </p>
      </section>

      <section
        aria-labelledby="titre-reserver"
        className="mt-10 rounded-2xl border border-gris-200 bg-surface p-6 shadow-sm"
      >
        <h2 id="titre-reserver" className="text-xl font-semibold text-gris-700">
          {t.reserver}
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
  const t = useTextes(TEXTES_LOGEMENT);
  const prix = useFormaterPrix();
  const variante = varianteStatut(logement.statut);
  // Le cadre du statut reprend l'intention de la pastille : vert si l'on peut
  // réserver, ambre si le bien revient, rouge s'il est retiré.
  const cadre =
    variante === 'positif'
      ? 'border-succes/30 bg-succes/10'
      : variante === 'attente'
        ? 'border-attente/30 bg-attente/10'
        : 'border-danger/30 bg-danger/10';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primaire">
          {t.hebergement}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-gris-700">
          {t.chambre(logement.type_chambre)}
        </h1>
        <div className="mt-2">
          <NoteMoyenne moyenne={logement.note_moyenne} nombre={logement.nombre_avis} />
        </div>
      </div>

      <p className="text-2xl font-bold text-primaire">
        {t.parNuit(prix(logement.tarif_nuitee))}
      </p>

      <ul aria-label={t.statutsLogement} className="flex flex-wrap gap-2">
        <li>
          <Badge variante={variante}>{libelleStatut(logement.statut)}</Badge>
        </li>
        <li>
          <Badge>{t.jusqua(logement.capacite)}</Badge>
        </li>
      </ul>

      <div className={`rounded-xl border p-4 ${cadre}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gris-600">
          {t.statut(libelleStatut(logement.statut))}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gris-600">
          {explicationStatut(logement.statut)}
        </p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-gris-200 bg-surface p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gris-500">{t.typeChambre}</dt>
          <dd className="text-right font-medium text-gris-700">
            {logement.type_chambre}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gris-500">{t.capacite}</dt>
          <dd className="text-right font-medium text-gris-700">
            {t.personnes(logement.capacite)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gris-500">{t.tarif}</dt>
          <dd className="text-right font-medium text-gris-700">
            {t.tarifParNuit(prix(logement.tarif_nuitee))}
          </dd>
        </div>
      </dl>
    </div>
  );
}
