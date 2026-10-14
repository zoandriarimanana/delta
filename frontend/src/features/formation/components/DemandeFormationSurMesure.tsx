/**
 * « Vous ne trouvez pas votre formation ? » — formation sur commande
 * (14 octobre 2026, retour du client).
 *
 * Un encadré sous le catalogue : le numéro du responsable des formations
 * pour qui préfère appeler (`VITE_TELEPHONE_FORMATION`, masqué tant qu'il
 * est vide — aucun numéro inventé), et un formulaire qui enregistre une
 * demande suivie dans l'administration. Ouvert à tous, avec ou sans compte.
 */

import { useState } from 'react';
import { CheckCircle2, GraduationCap, Phone } from 'lucide-react';
import { isAxiosError } from 'axios';

import { useTextes } from '@/lib/langue';

import { envoyerDemandeFormation } from '../demandeFormation.api';
import { TEXTES_DEMANDE_FORMATION } from '../demandeFormation.textes';
import type { LieuFormation } from '../demandeFormation.types';

const TELEPHONE = (import.meta.env.VITE_TELEPHONE_FORMATION ?? '').trim();
const LIEUX: LieuFormation[] = ['Indifferent', 'Chez_delta', 'En_entreprise'];
const CHAMP =
  'mt-1 w-full rounded-lg border-2 border-gris-200 bg-surface px-3 py-2 text-gris-700 focus:border-primaire focus:outline-none';

export default function DemandeFormationSurMesure() {
  const t = useTextes(TEXTES_DEMANDE_FORMATION);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sujet, setSujet] = useState('');
  const [participants, setParticipants] = useState(1);
  const [niveau, setNiveau] = useState('');
  const [periode, setPeriode] = useState('');
  const [lieu, setLieu] = useState<LieuFormation>('Indifferent');
  const [message, setMessage] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');

  async function envoyer() {
    setEnvoi(true);
    setErreur(null);
    try {
      await envoyerDemandeFormation({
        sujet: sujet.trim(),
        nombre_participants: participants,
        niveau: niveau.trim() || null,
        periode_souhaitee: periode.trim() || null,
        lieu,
        message: message.trim() || null,
        nom_contact: nom.trim(),
        contact: contact.trim(),
      });
      setEnvoyee(true);
    } catch (e) {
      setErreur(
        isAxiosError(e) && e.response?.status === 429 ? t.tropDeDemandes : t.erreur
      );
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <aside className="mt-12 rounded-2xl border border-primaire/20 bg-primaire/5 p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primaire/10 text-primaire">
          <GraduationCap size={24} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-serif font-bold text-primaire">{t.titre}</h2>
          <p className="mt-1 text-gris-600">{t.accroche}</p>
          {TELEPHONE !== '' && (
            <p className="mt-2 flex items-center gap-2 font-medium text-gris-700">
              <Phone size={16} aria-hidden className="text-primaire" />
              {t.appeler(TELEPHONE)}
            </p>
          )}

          {envoyee ? (
            <p
              role="status"
              className="mt-4 flex items-center gap-2 rounded-lg bg-succes/10 p-3 text-sm font-medium text-succes"
            >
              <CheckCircle2 size={18} aria-hidden />
              {t.merci}
            </p>
          ) : !ouvert ? (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="mt-4 rounded-full bg-action px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-action-fonce"
            >
              {t.ouvrir}
            </button>
          ) : (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void envoyer();
              }}
            >
              <label className="text-sm font-medium text-gris-700 sm:col-span-2">
                {t.sujet}
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={sujet}
                  onChange={(e) => setSujet(e.target.value)}
                  placeholder={t.exempleSujet}
                  className={CHAMP}
                />
              </label>
              <label className="text-sm font-medium text-gris-700">
                {t.participants}
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={participants}
                  onChange={(e) => setParticipants(Number(e.target.value))}
                  className={CHAMP}
                />
              </label>
              <label className="text-sm font-medium text-gris-700">
                {t.lieu}
                <select
                  value={lieu}
                  onChange={(e) => setLieu(e.target.value as LieuFormation)}
                  className={CHAMP}
                >
                  {LIEUX.map((l) => (
                    <option key={l} value={l}>
                      {t.lieux[l]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-gris-700">
                {t.niveau}
                <input
                  maxLength={100}
                  value={niveau}
                  onChange={(e) => setNiveau(e.target.value)}
                  placeholder={t.exempleNiveau}
                  className={CHAMP}
                />
              </label>
              <label className="text-sm font-medium text-gris-700">
                {t.periode}
                <input
                  maxLength={200}
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                  placeholder={t.exemplePeriode}
                  className={CHAMP}
                />
              </label>
              <label className="text-sm font-medium text-gris-700 sm:col-span-2">
                {t.message}
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={CHAMP}
                />
              </label>
              <label className="text-sm font-medium text-gris-700">
                {t.nom}
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className={CHAMP}
                />
              </label>
              <label className="text-sm font-medium text-gris-700">
                {t.contact}
                <input
                  required
                  minLength={5}
                  maxLength={150}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className={CHAMP}
                />
              </label>
              {erreur !== null && (
                <p role="alert" className="text-sm text-danger sm:col-span-2">
                  {erreur}
                </p>
              )}
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={envoi}
                  className="rounded-full bg-action px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-action-fonce disabled:opacity-60"
                >
                  {envoi ? t.envoi : t.envoyer}
                </button>
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  className="rounded-full px-4 py-2.5 font-medium text-gris-600 hover:bg-gris-100"
                >
                  {t.fermer}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}
