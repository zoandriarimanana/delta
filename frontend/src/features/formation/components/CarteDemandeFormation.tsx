/**
 * Une demande de formation dans l'administration : ce qui est demandé, qui
 * rappeler, et le suivi (statut et note interne).
 */

import { useState } from 'react';
import { Archive, CalendarDays, MapPin, Phone, Save, Users } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import type { VarianteBadge } from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';
import { formaterDate } from '@/features/commande/commande.service';

import {
  LIBELLES_LIEU,
  LIBELLES_STATUT_DEMANDE,
} from '../demandeFormation.administration';
import type {
  DemandeFormation,
  StatutDemandeFormation,
} from '../demandeFormation.types';

const VARIANTES: Record<StatutDemandeFormation, VarianteBadge> = {
  Nouvelle: 'attente',
  En_discussion: 'info',
  Planifiee: 'positif',
  Refusee: 'neutre',
};
const STATUTS = Object.keys(LIBELLES_STATUT_DEMANDE) as StatutDemandeFormation[];

interface Proprietes {
  demande: DemandeFormation;
  enCours: boolean;
  surSuivre: (statut: StatutDemandeFormation, note: string | null) => void;
  surArchiver: () => void;
}

export default function CarteDemandeFormation({
  demande,
  enCours,
  surSuivre,
  surArchiver,
}: Proprietes) {
  const [statut, setStatut] = useState(demande.statut);
  const [note, setNote] = useState(demande.note_interne ?? '');
  const modifie = statut !== demande.statut || note !== (demande.note_interne ?? '');

  return (
    <li
      className={`rounded-2xl border bg-surface p-5 shadow-sm ${
        demande.statut === 'Nouvelle' ? 'border-attente/50' : 'border-gris-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gris-700">{demande.sujet}</h2>
          <p className="text-xs text-gris-500">
            Reçue le {formaterDate(demande.date_demande)}
            {demande.id_client !== null && ` · client n° ${demande.id_client}`}
          </p>
        </div>
        <Badge variante={VARIANTES[demande.statut]}>
          {LIBELLES_STATUT_DEMANDE[demande.statut]}
        </Badge>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gris-600">
        <li className="flex items-center gap-1.5">
          <Users size={14} aria-hidden /> {demande.nombre_participants} participant(s)
          {demande.niveau && ` · ${demande.niveau}`}
        </li>
        <li className="flex items-center gap-1.5">
          <MapPin size={14} aria-hidden /> {LIBELLES_LIEU[demande.lieu]}
        </li>
        {demande.periode_souhaitee && (
          <li className="flex items-center gap-1.5">
            <CalendarDays size={14} aria-hidden /> {demande.periode_souhaitee}
          </li>
        )}
      </ul>
      {demande.message && (
        <p className="mt-2 whitespace-pre-line rounded-lg bg-gris-100 p-3 text-sm text-gris-700">
          {demande.message}
        </p>
      )}
      <p className="mt-3 flex items-center gap-2 text-sm font-medium text-gris-700">
        <Phone size={14} aria-hidden className="text-primaire" />
        {demande.nom_contact} — {demande.contact}
      </p>

      <div className="mt-4 grid gap-3 border-t border-gris-200 pt-4 sm:grid-cols-[12rem_1fr]">
        <label className="text-sm font-medium text-gris-700">
          Avancement
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as StatutDemandeFormation)}
            className="mt-1 w-full rounded-lg border border-gris-300 bg-surface px-3 py-2 text-sm"
          >
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUT_DEMANDE[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gris-700">
          Note interne
          <textarea
            rows={2}
            maxLength={4000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. rappelé le 15/10, devis envoyé"
            className="mt-1 w-full rounded-lg border border-gris-300 bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Bouton
          variante="valider"
          icone={Save}
          disabled={!modifie || enCours}
          onClick={() => surSuivre(statut, note.trim() || null)}
        >
          Enregistrer le suivi
        </Bouton>
        <Bouton
          variante="danger-contour"
          icone={Archive}
          disabled={enCours}
          onClick={surArchiver}
        >
          Archiver
        </Bouton>
      </div>
    </li>
  );
}
