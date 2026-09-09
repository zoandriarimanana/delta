/**
 * Fiche d'un membre du personnel, administration.
 *
 * **L'archivage et l'anonymisation rendent la ligne invisible** de
 * `GET /personnel/{id}` (pas de paramètre `inclure_supprimes` exposé,
 * contrairement à PRODUIT) : recharger la fiche après l'un ou l'autre
 * retomberait sur un 404. La page garde donc sa **dernière donnée connue**
 * en mémoire locale plutôt que de la relire, pour continuer à afficher le
 * nom du membre dans l'affordance « Restaurer » au moment précis où l'admin
 * pourrait vouloir l'utiliser.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import Avatar from '@/components/ui/Avatar';
import Bouton from '@/components/ui/Bouton';

import FormulairePersonnel from '../components/FormulairePersonnel';
import {
  anonymiserPersonnel,
  archiverPersonnel,
  modifierPersonnel,
  restaurerPersonnel,
  supprimerPhotoPersonnel,
  televerserPhotoPersonnel,
  urlPhotoPersonnel,
} from '../personnel.api';
import {
  messageDAdministration,
  usePersonnelDetailAdministration,
} from '../personnel.administration';
import type { Personnel, PersonnelEnvoye } from '../personnel.types';

export default function PersonnelDetailAdministrationPage() {
  const { idPersonnel } = useParams<{ idPersonnel: string }>();
  const id = Number(idPersonnel);

  const detail = usePersonnelDetailAdministration(id);
  const [affichage, setAffichage] = useState<Personnel | null>(null);
  const [archiveLocalement, setArchiveLocalement] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [photoChoisie, setPhotoChoisie] = useState<File | null>(null);
  // Change à chaque écriture réussie sur la photo, pour forcer `Avatar` à se
  // remonter (cf. sa docstring) — sans ça, l'ancien état d'erreur/l'ancienne
  // image resteraient affichés après un remplacement ou un retrait, l'URL
  // étant identique et `Cache-Control: no-store` seul ne rafraîchit pas un
  // composant déjà monté.
  const [versionPhoto, setVersionPhoto] = useState(0);

  // Synchronise depuis le chargement serveur, sans jamais effacer une donnée
  // locale plus récente issue d'une action (cf. docstring du fichier).
  useEffect(() => {
    if (detail.personnel !== null) {
      setAffichage(detail.personnel);
    }
  }, [detail.personnel]);

  const fermerEdition = useCallback(() => {
    setModeEdition(false);
    setPhotoChoisie(null);
  }, []);

  async function enregistrer(valeurs: PersonnelEnvoye) {
    setEnvoi(true);
    setErreurAction(null);
    try {
      setAffichage(await modifierPersonnel(id, valeurs));
      if (photoChoisie !== null) {
        await televerserPhotoPersonnel(id, photoChoisie);
        setVersionPhoto((v) => v + 1);
      }
      fermerEdition();
    } catch (erreur) {
      setErreurAction(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  async function retirerPhoto() {
    setEnvoi(true);
    setErreurAction(null);
    try {
      await supprimerPhotoPersonnel(id);
      setVersionPhoto((v) => v + 1);
    } catch (erreur) {
      setErreurAction(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  async function archiver() {
    setEnvoi(true);
    setErreurAction(null);
    try {
      await archiverPersonnel(id);
      setArchiveLocalement(true);
    } catch (erreur) {
      setErreurAction(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  async function restaurer() {
    setEnvoi(true);
    setErreurAction(null);
    try {
      setAffichage(await restaurerPersonnel(id));
      setArchiveLocalement(false);
    } catch (erreur) {
      setErreurAction(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  async function anonymiser() {
    setEnvoi(true);
    setErreurAction(null);
    try {
      setAffichage(await anonymiserPersonnel(id));
      // `anonymiser()` archive la ligne côté serveur, au même titre que
      // `archiver()` — sans ce drapeau, Modifier/Archiver resteraient
      // proposés sur une ligne devenue archivée, et échoueraient en 404 au
      // clic suivant.
      setArchiveLocalement(true);
    } catch (erreur) {
      setErreurAction(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (detail.chargement && affichage === null) {
    return (
      <p role="status" className="text-warm-gray-500">
        Chargement…
      </p>
    );
  }

  if (affichage === null) {
    return (
      <p
        role="alert"
        className="rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
      >
        {detail.erreur ?? 'Membre du personnel introuvable.'}
      </p>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            key={versionPhoto}
            src={urlPhotoPersonnel(affichage.id_personnel)}
            alt=""
            taille="grande"
          />
          <h1 className="text-2xl font-semibold text-warm-gray-700">
            {affichage.prenom} {affichage.nom}
          </h1>
        </div>
        <Link
          to="/personnel/administration"
          className="text-sm text-terracotta underline"
        >
          Retour à la liste
        </Link>
      </div>

      {!archiveLocalement && !modeEdition && (
        <Bouton
          variante="secondaire"
          onClick={() => void retirerPhoto()}
          disabled={envoi}
          className="mt-3"
        >
          Retirer la photo
        </Bouton>
      )}

      {erreurAction !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {erreurAction}
        </p>
      )}

      {archiveLocalement && (
        <p className="mt-4 flex items-center justify-between rounded border border-warm-gray-200 bg-white p-3 text-sm text-warm-gray-700">
          <span>Ce membre a été archivé.</span>
          <Bouton
            variante="secondaire"
            onClick={() => void restaurer()}
            disabled={envoi}
          >
            Restaurer
          </Bouton>
        </p>
      )}

      {modeEdition ? (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-medium text-warm-gray-700">
            Modifier le membre
          </h2>
          <FormulairePersonnel
            personnel={affichage}
            envoi={envoi}
            erreur={erreurAction}
            surEnvoi={(valeurs) => void enregistrer(valeurs)}
            surAnnulation={fermerEdition}
            surPhotoChoisie={setPhotoChoisie}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-warm-gray-200 bg-white p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-warm-gray-500">Fonction</dt>
              <dd className="text-warm-gray-700">{affichage.fonction}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">E-mail</dt>
              <dd className="text-warm-gray-700">{affichage.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Téléphone</dt>
              <dd className="text-warm-gray-700">{affichage.telephone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Date d'embauche</dt>
              <dd className="text-warm-gray-700">{affichage.date_embauche ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Spécialité</dt>
              <dd className="text-warm-gray-700">{affichage.specialite ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-warm-gray-500">Zone de livraison</dt>
              <dd className="text-warm-gray-700">{affichage.zone_livraison ?? '—'}</dd>
            </div>
          </dl>

          {!archiveLocalement && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Bouton variante="secondaire" onClick={() => setModeEdition(true)}>
                Modifier
              </Bouton>
              <Bouton
                variante="secondaire"
                onClick={() => void archiver()}
                disabled={envoi}
              >
                Archiver
              </Bouton>
              {/* Sans effet visible si déjà anonymisé — l'action est
                  idempotente côté serveur, aucune garde supplémentaire n'est
                  nécessaire ici. */}
              <Bouton
                variante="secondaire"
                onClick={() => void anonymiser()}
                disabled={envoi}
              >
                Anonymiser
              </Bouton>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
