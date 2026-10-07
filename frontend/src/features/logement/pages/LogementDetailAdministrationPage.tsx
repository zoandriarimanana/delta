/**
 * Fiche d'un logement, administration.
 *
 * Même patron que `SalleDetailAdministrationPage`, plus l'**état du bien**
 * (disponible, en maintenance, hors service). Les réservations du logement
 * comptent ici plus qu'ailleurs : mettre un logement en maintenance n'annule
 * pas celles qui existent déjà (`docs/architecture.md`) — la fiche permet de
 * les voir avant de le faire.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import ChampFiche from '@/components/ui/ChampFiche';
import NoteMoyenne from '@/components/ui/NoteMoyenne';
import { formaterMontant } from '@/features/commande/commande.service';
import GestionGalerie from '@/features/galerie/components/GestionGalerie';
import ReservationsDuBien from '@/features/reservation/components/ReservationsDuBien';
import { imagePour } from '@/lib/images';
import { useNoteFiche } from '@/lib/useNoteFiche';

import FormulaireLogement from '../components/FormulaireLogement';
import {
  estArchive,
  messageDAdministration,
  useActionsLogements,
  useLogementsAdministration,
} from '../logement.administration';
import { modifierLogement, recupererLogement } from '../logement.api';
import { libelleStatut, varianteStatut } from '../logement.service';
import type { LogementModifie } from '../logement.types';

const CLASSES_ALERTE =
  'rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger';

export default function LogementDetailAdministrationPage() {
  const { idLogement } = useParams<{ idLogement: string }>();
  const id = Number(idLogement);

  const liste = useLogementsAdministration();
  const actions = useActionsLogements(liste.recharger);
  const [modeEdition, setModeEdition] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const logement = liste.logements.find((l) => l.id_logement === id) ?? null;
  const archive = logement !== null && estArchive(logement);
  const note = useNoteFiche(id, logement !== null && !archive, recupererLogement);

  async function enregistrer(donnees: LogementModifie) {
    setEnvoi(true);
    setErreurEdition(null);
    try {
      await modifierLogement(id, donnees);
      liste.recharger();
      setModeEdition(false);
    } catch (erreur) {
      setErreurEdition(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (liste.chargement && logement === null) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }
  if (logement === null) {
    return (
      <p role="alert" className={CLASSES_ALERTE}>
        {liste.erreur ?? 'Logement introuvable.'}
      </p>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <img
            src={imagePour('logement', logement.id_logement)}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
          <h1 className="text-2xl font-semibold text-gris-700">
            Chambre {logement.type_chambre}
          </h1>
          <Badge variante={archive ? 'negatif' : 'positif'}>
            {archive ? 'Archivé' : 'Actif'}
          </Badge>
        </div>
        <Link to="/personnel/logements" className="text-sm text-primaire underline">
          Retour à la liste
        </Link>
      </div>

      {actions.erreur !== null && (
        <p role="alert" className={`mt-4 ${CLASSES_ALERTE}`}>
          {actions.erreur}
        </p>
      )}

      {modeEdition ? (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <h2 className="mb-4 text-lg font-medium text-gris-700">
            Modifier le logement
          </h2>
          <FormulaireLogement
            logement={logement}
            envoi={envoi}
            erreur={erreurEdition}
            surEnvoi={(donnees) => void enregistrer(donnees)}
            surAnnulation={() => {
              setModeEdition(false);
              setErreurEdition(null);
            }}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-gris-200 bg-surface p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ChampFiche intitule="Type de chambre">{logement.type_chambre}</ChampFiche>
            <ChampFiche intitule="Capacité">{logement.capacite} personne(s)</ChampFiche>
            <ChampFiche intitule="Tarif à la nuitée">
              {formaterMontant(logement.tarif_nuitee)}
            </ChampFiche>
            <ChampFiche intitule="État du bien">
              <Badge variante={varianteStatut(logement.statut)}>
                {libelleStatut(logement.statut)}
              </Badge>
            </ChampFiche>
            <ChampFiche intitule="Avis des clients">
              {note.disponible ? (
                <NoteMoyenne moyenne={note.moyenne} nombre={note.nombre} />
              ) : (
                <span className="text-sm text-gris-500">
                  {archive ? 'Non calculé pour un logement archivé' : '—'}
                </span>
              )}
            </ChampFiche>
            <div className="sm:col-span-2">
              <ChampFiche intitule="Description">
                {logement.description !== null ? (
                  <span className="whitespace-pre-line">{logement.description}</span>
                ) : (
                  <span className="text-gris-500">Non rédigée</span>
                )}
              </ChampFiche>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {archive ? (
              <Bouton
                variante="secondaire"
                disabled={actions.envoi}
                onClick={() => void actions.restaurerLeLogement(id)}
              >
                Restaurer
              </Bouton>
            ) : (
              <>
                <Bouton variante="secondaire" onClick={() => setModeEdition(true)}>
                  Modifier
                </Bouton>
                <Bouton
                  variante="secondaire"
                  disabled={actions.envoi}
                  onClick={() => void actions.archiverLeLogement(id)}
                >
                  Archiver
                </Bouton>
              </>
            )}
          </div>
        </div>
      )}

      {archive ? (
        <p className="mt-6 rounded-xl border border-gris-200 bg-surface p-4 text-sm text-gris-500">
          Les photos d’un logement archivé sont conservées, mais ne se gèrent qu’une
          fois restauré.
        </p>
      ) : (
        <GestionGalerie bien={{ logement: id }} />
      )}

      <ReservationsDuBien bien={{ logement: id }} />
    </section>
  );
}
