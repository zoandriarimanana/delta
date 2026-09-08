/**
 * Formulaire personnel, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales et l'appel final.
 * `est_administrateur` et le mot de passe ne figurent nulle part ici : ni le
 * type `PersonnelEnvoye` ni le formulaire ne les proposent, même absence que
 * côté serveur (`PersonnelCreate`/`PersonnelUpdate`).
 */

import { useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import type { FonctionPersonnel, Personnel, PersonnelEnvoye } from '../personnel.types';

const FONCTIONS: FonctionPersonnel[] = [
  'Formateur',
  'Livreur',
  'Cuisinier',
  'Receptionniste',
  'Autre',
];

interface Proprietes {
  /** Membre à modifier, ou `undefined` pour une création. */
  personnel?: Personnel;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: PersonnelEnvoye) => void;
  surAnnulation: () => void;
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
}: Proprietes) {
  const [valeurs, setValeurs] = useState<PersonnelEnvoye>(() =>
    valeursInitiales(personnel)
  );

  function modifier<C extends keyof PersonnelEnvoye>(
    champ: C,
    valeur: PersonnelEnvoye[C]
  ) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
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
