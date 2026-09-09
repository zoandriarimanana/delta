/**
 * Administration du personnel.
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : la lecture exige déjà un salarié authentifié côté serveur,
 * et l'écriture `get_current_personnel_administrateur`.
 *
 * **Un tableau, pas des cartes** : on y compare des lignes, comme
 * `AdministrationAbonnementsPage`.
 *
 * **Aucune action destructive ici** : archiver, restaurer et anonymiser
 * vivent sur la fiche (`PersonnelDetailAdministrationPage`), même partage
 * que pour `AdministrationAbonnementsPage`/`AbonnementDetailAdministrationPage`
 * — la liste ne fait que créer et donner accès à la fiche.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import Avatar from '@/components/ui/Avatar';
import Bouton from '@/components/ui/Bouton';

import FormulairePersonnel from '../components/FormulairePersonnel';
import { televerserPhotoPersonnel, urlPhotoPersonnel } from '../personnel.api';
import { useAnnuairePersonnel, useCreerPersonnel } from '../personnel.administration';
import type { FonctionPersonnel, PersonnelEnvoye } from '../personnel.types';

type Edition = { mode: 'ferme' } | { mode: 'creation' };

const FONCTIONS: FonctionPersonnel[] = [
  'Formateur',
  'Livreur',
  'Cuisinier',
  'Receptionniste',
  'Autre',
];

export default function AdministrationPersonnelPage() {
  const [filtreFonction, setFiltreFonction] = useState<FonctionPersonnel | ''>('');
  const donnees = useAnnuairePersonnel(filtreFonction);
  const creation = useCreerPersonnel(donnees.recharger);
  const [edition, setEdition] = useState<Edition>({ mode: 'ferme' });
  const [photoChoisie, setPhotoChoisie] = useState<File | null>(null);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);

  const fermer = useCallback(() => {
    setEdition({ mode: 'ferme' });
    setPhotoChoisie(null);
    setErreurPhoto(null);
  }, []);

  async function enregistrer(valeurs: PersonnelEnvoye) {
    setErreurPhoto(null);
    const cree = await creation.creerUnMembre(valeurs);
    if (cree === null) {
      return;
    }
    // La création a réussi indépendamment de la photo : un échec ici ne
    // doit pas empêcher de fermer le formulaire ni faire perdre le membre
    // tout juste créé — il reste modifiable depuis sa fiche, photo comprise.
    // `fermer()` n'est donc pas réutilisé ici : il effacerait `erreurPhoto`
    // au moment même où on vient de la poser.
    if (photoChoisie !== null) {
      try {
        await televerserPhotoPersonnel(cree.id_personnel, photoChoisie);
        donnees.recharger();
      } catch {
        setErreurPhoto(
          `${cree.prenom} ${cree.nom} a été créé(e), mais l'envoi de la photo a échoué. ` +
            'Réessayez depuis sa fiche.'
        );
      }
    }
    setEdition({ mode: 'ferme' });
    setPhotoChoisie(null);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-warm-gray-700">
          Administration du personnel
        </h1>
        {edition.mode === 'ferme' && (
          <Bouton onClick={() => setEdition({ mode: 'creation' })}>
            Nouveau membre
          </Bouton>
        )}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-warm-gray-700">
        Filtrer par fonction
        <select
          value={filtreFonction}
          onChange={(e) => setFiltreFonction(e.target.value as FonctionPersonnel | '')}
          className="rounded border border-warm-gray-300 px-2 py-1"
        >
          <option value="">Toutes</option>
          {FONCTIONS.map((valeur) => (
            <option key={valeur} value={valeur}>
              {valeur}
            </option>
          ))}
        </select>
      </label>

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {donnees.erreur}
        </p>
      )}

      {erreurPhoto !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {erreurPhoto}
        </p>
      )}

      {edition.mode === 'creation' && (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            Nouveau membre
          </h2>
          <FormulairePersonnel
            envoi={creation.envoi}
            erreur={creation.erreur}
            surEnvoi={(valeurs) => void enregistrer(valeurs)}
            surAnnulation={fermer}
            surPhotoChoisie={setPhotoChoisie}
          />
        </div>
      )}

      {donnees.chargement && (
        <p role="status" className="mt-6 text-warm-gray-500">
          Chargement…
        </p>
      )}

      {!donnees.chargement && donnees.personnels.length === 0 && (
        <p className="mt-6 text-warm-gray-600">Aucun membre à afficher.</p>
      )}

      {donnees.personnels.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-white shadow-sm">
            <thead>
              <tr className="border-b border-warm-gray-200 text-left">
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Nom
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  Fonction
                </th>
                <th className="px-3 py-2 text-sm font-medium text-warm-gray-600">
                  E-mail
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-gray-200">
              {donnees.personnels.map((personnel) => (
                <tr key={personnel.id_personnel}>
                  <td className="px-3 py-2">
                    <Avatar
                      src={urlPhotoPersonnel(personnel.id_personnel)}
                      alt=""
                      taille="petite"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {personnel.prenom} {personnel.nom}
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-700">
                    {personnel.fonction}
                  </td>
                  <td className="px-3 py-2 text-sm text-warm-gray-600">
                    {personnel.email}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/personnel/administration/${personnel.id_personnel}`}
                      className="text-sm text-terracotta underline"
                    >
                      Voir la fiche
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
