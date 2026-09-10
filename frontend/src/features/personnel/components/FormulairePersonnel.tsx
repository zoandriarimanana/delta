/**
 * Formulaire personnel, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales et l'appel final.
 * `est_administrateur` et le mot de passe ne figurent nulle part ici : ni le
 * type `PersonnelEnvoye` ni le formulaire ne les proposent, même absence que
 * côté serveur (`PersonnelCreate`/`PersonnelUpdate`).
 *
 * **La photo ne transite pas par `surEnvoi`** : `PersonnelEnvoye` reste un
 * corps JSON, `POST /personnel` n'a pas changé (cf. `docs/architecture.md`).
 * Le fichier choisi, s'il y en a un, est remonté séparément via
 * `surPhotoChoisie` — c'est l'appelant (la page) qui l'envoie ensuite à
 * `POST /personnel/{id}/photo`, une fois l'identifiant connu (immédiatement
 * en modification, seulement après la création en... création).
 */

import { useState } from 'react';

import Avatar from '@/components/ui/Avatar';
import Bouton from '@/components/ui/Bouton';

import { urlPhotoPersonnel } from '../personnel.api';
import type { FonctionPersonnel, Personnel, PersonnelEnvoye } from '../personnel.types';

const FONCTIONS: FonctionPersonnel[] = [
  'Formateur',
  'Livreur',
  'Cuisinier',
  'Receptionniste',
  'Autre',
];

const TYPES_ACCEPTES = 'image/jpeg,image/png';

interface Proprietes {
  /** Membre à modifier, ou `undefined` pour une création. */
  personnel?: Personnel;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: PersonnelEnvoye) => void;
  surAnnulation: () => void;
  /** Rappelé à chaque changement du champ fichier, `null` si vidé. */
  surPhotoChoisie?: (fichier: File | null) => void;
}

function valeursInitiales(personnel: Personnel | undefined): PersonnelEnvoye {
  return {
    nom: personnel?.nom ?? '',
    prenom: personnel?.prenom ?? '',
    fonction: personnel?.fonction ?? 'Autre',
    email: personnel?.email ?? '',
    telephone: personnel?.telephone ?? '',
    date_embauche: personnel?.date_embauche ?? '',
    specialite: personnel?.specialite ?? '',
    zone_livraison: personnel?.zone_livraison ?? '',
  };
}

export default function FormulairePersonnel({
  personnel,
  envoi,
  erreur,
  surEnvoi,
  surAnnulation,
  surPhotoChoisie,
}: Proprietes) {
  const [valeurs, setValeurs] = useState<PersonnelEnvoye>(() =>
    valeursInitiales(personnel)
  );
  const [previsualisation, setPrevisualisation] = useState<string | null>(null);

  function modifier<C extends keyof PersonnelEnvoye>(
    champ: C,
    valeur: PersonnelEnvoye[C]
  ) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
  }

  function choisirPhoto(fichier: File | null) {
    setPrevisualisation((precedente) => {
      // Révoque l'URL objet précédente avant d'en créer une nouvelle — sans
      // ça, chaque changement de fichier fuit la précédente jusqu'au
      // rechargement de la page.
      if (precedente !== null) {
        URL.revokeObjectURL(precedente);
      }
      return fichier === null ? null : URL.createObjectURL(fichier);
    });
    surPhotoChoisie?.(fichier);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        surEnvoi({
          ...valeurs,
          telephone: valeurs.telephone === '' ? null : valeurs.telephone,
          date_embauche: valeurs.date_embauche === '' ? null : valeurs.date_embauche,
          specialite: valeurs.specialite === '' ? null : valeurs.specialite,
          zone_livraison: valeurs.zone_livraison === '' ? null : valeurs.zone_livraison,
        });
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          {/* Sans ce libellé, rien ne distingue "voici la photo actuelle"
              de "voici ce que sera la nouvelle photo si vous validez" — le
              même <Avatar> affiche l'une puis l'autre selon qu'un fichier a
              été choisi, et un admin qui modifie une fiche déjà pourvue
              d'une photo peut confondre les deux états. Aucun libellé tant
              qu'on est en création sans fichier choisi : il n'y a alors
              aucune ambiguïté à lever, "Photo actuelle" serait même
              trompeur (aucune photo n'existe encore). */}
          {(previsualisation !== null || personnel !== undefined) && (
            <span className="text-xs text-warm-gray-500">
              {previsualisation !== null ? 'Nouvel aperçu' : 'Photo actuelle'}
            </span>
          )}
          <Avatar
            src={previsualisation ?? urlPhotoPersonnel(personnel?.id_personnel ?? 0)}
            alt=""
            taille="grande"
          />
        </div>
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Photo de profil <span className="text-warm-gray-500">(facultatif)</span>
          <input
            type="file"
            accept={TYPES_ACCEPTES}
            onChange={(e) => choisirPhoto(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <span className="text-xs text-warm-gray-500">
            JPEG ou PNG, 2 Mio maximum.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Nom
          <input
            required
            value={valeurs.nom}
            onChange={(e) => modifier('nom', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Prénom
          <input
            required
            value={valeurs.prenom}
            onChange={(e) => modifier('prenom', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Fonction
          <select
            value={valeurs.fonction}
            onChange={(e) => modifier('fonction', e.target.value as FonctionPersonnel)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {FONCTIONS.map((valeur) => (
              <option key={valeur} value={valeur}>
                {valeur}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          E-mail professionnel
          <input
            type="email"
            required
            value={valeurs.email}
            onChange={(e) => modifier('email', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Téléphone <span className="text-warm-gray-500">(facultatif)</span>
          <input
            value={valeurs.telephone ?? ''}
            onChange={(e) => modifier('telephone', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Date d'embauche <span className="text-warm-gray-500">(facultatif)</span>
          <input
            type="date"
            value={valeurs.date_embauche ?? ''}
            onChange={(e) => modifier('date_embauche', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        {/* N'a de sens que pour un formateur, mais reste libre : le MLD ne
            conditionne pas ce champ à la fonction (cf. docs/mld.md). */}
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Spécialité <span className="text-warm-gray-500">(facultatif)</span>
          <input
            value={valeurs.specialite ?? ''}
            onChange={(e) => modifier('specialite', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Zone de livraison <span className="text-warm-gray-500">(facultatif)</span>
          <input
            value={valeurs.zone_livraison ?? ''}
            onChange={(e) => modifier('zone_livraison', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>
      </div>

      {erreur !== null && (
        <p
          role="alert"
          className="rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {erreur}
        </p>
      )}

      <div className="flex gap-2">
        <Bouton type="submit" disabled={envoi}>
          {envoi
            ? 'Enregistrement…'
            : personnel === undefined
              ? 'Créer'
              : 'Enregistrer'}
        </Bouton>
        <Bouton variante="secondaire" onClick={surAnnulation}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
