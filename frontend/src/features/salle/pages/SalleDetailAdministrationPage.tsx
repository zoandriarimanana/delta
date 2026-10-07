/**
 * Fiche d'une salle, administration.
 *
 * Même patron que `ProduitDetailAdministrationPage` : tous les champs, la note
 * des clients, les actions, et **les réservations de la salle** — rendues par
 * un composant du module `reservation`, que cette page monte sans appeler
 * elle-même l'API de réservation.
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

import FormulaireSalle from '../components/FormulaireSalle';
import {
  estArchive,
  messageDAdministration,
  useActionsSalles,
  useSallesAdministration,
} from '../salle.administration';
import { modifierSalle, recupererSalle } from '../salle.api';
import type { SalleEnvoyee } from '../salle.types';

const CLASSES_ALERTE =
  'rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger';

export default function SalleDetailAdministrationPage() {
  const { idSalle } = useParams<{ idSalle: string }>();
  const id = Number(idSalle);

  const liste = useSallesAdministration();
  const actions = useActionsSalles(liste.recharger);
  const [modeEdition, setModeEdition] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const salle = liste.salles.find((s) => s.id_salle === id) ?? null;
  const archive = salle !== null && estArchive(salle);
  const note = useNoteFiche(id, salle !== null && !archive, recupererSalle);

  async function enregistrer(donnees: SalleEnvoyee) {
    setEnvoi(true);
    setErreurEdition(null);
    try {
      await modifierSalle(id, donnees);
      liste.recharger();
      setModeEdition(false);
    } catch (erreur) {
      setErreurEdition(messageDAdministration(erreur));
    } finally {
      setEnvoi(false);
    }
  }

  if (liste.chargement && salle === null) {
    return (
      <p role="status" className="text-gris-500">
        Chargement…
      </p>
    );
  }
  if (salle === null) {
    return (
      <p role="alert" className={CLASSES_ALERTE}>
        {liste.erreur ?? 'Salle introuvable.'}
      </p>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <img
            src={imagePour('salle', salle.id_salle)}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
          <h1 className="text-2xl font-semibold text-gris-700">{salle.nom}</h1>
          <Badge variante={archive ? 'negatif' : 'positif'}>
            {archive ? 'Archivée' : 'Active'}
          </Badge>
        </div>
        <Link to="/personnel/salles" className="text-sm text-primaire underline">
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
          <h2 className="mb-4 text-lg font-medium text-gris-700">Modifier la salle</h2>
          <FormulaireSalle
            salle={salle}
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
            <ChampFiche intitule="Capacité">{salle.capacite} personnes</ChampFiche>
            <ChampFiche intitule="Tarif horaire">
              {salle.tarif_horaire !== null
                ? formaterMontant(salle.tarif_horaire)
                : 'Non loué à l’heure'}
            </ChampFiche>
            <ChampFiche intitule="Tarif journalier">
              {salle.tarif_journee !== null
                ? formaterMontant(salle.tarif_journee)
                : 'Non loué à la journée'}
            </ChampFiche>
            <ChampFiche intitule="Avis des clients">
              {note.disponible ? (
                <NoteMoyenne moyenne={note.moyenne} nombre={note.nombre} />
              ) : (
                <span className="text-sm text-gris-500">
                  {archive ? 'Non calculé pour une salle archivée' : '—'}
                </span>
              )}
            </ChampFiche>
            <div className="sm:col-span-2">
              <ChampFiche intitule="Équipements">
                {salle.equipements ?? (
                  <span className="text-gris-500">Non renseignés</span>
                )}
              </ChampFiche>
            </div>
            <div className="sm:col-span-2">
              <ChampFiche intitule="Description">
                {salle.description !== null ? (
                  <span className="whitespace-pre-line">{salle.description}</span>
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
                onClick={() => void actions.restaurerLaSalle(id)}
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
                  onClick={() => void actions.archiverLaSalle(id)}
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
          Les photos d’une salle archivée sont conservées, mais ne se gèrent qu’une fois
          restaurée.
        </p>
      ) : (
        <GestionGalerie bien={{ salle: id }} />
      )}

      <ReservationsDuBien bien={{ salle: id }} />
    </section>
  );
}
