/**
 * Réservations du client connecté : à venir, passées, annulées.
 *
 * L'isolation est garantie côté serveur : le filtre vient du jeton, et la
 * réservation d'un autre répond 404 — jamais 403, qui confirmerait son
 * existence. Aucun identifiant de client n'est envoyé d'ici.
 *
 * **Attend la vérification initiale de session** (T0.10, `useChargementSession`)
 * avant de décider quoi afficher : sans elle, un client réellement connecté
 * verrait, à chaque chargement de page, un message « connectez-vous » suivi
 * d'un chargement tardif de ses réservations — la vérification de session
 * étant asynchrone (`GET /auth/moi`), pas la lecture synchrone d'un jeton en
 * `localStorage` comme avant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BedDouble, Building2, CalendarDays, GraduationCap } from 'lucide-react';

import { textesCourants, useTextes } from '@/lib/langue';
import { useChargementSession, useEstConnecte } from '@/lib/useEstConnecte';

import { TEXTES_RESERVATION } from '../reservation.textes';
import CarteReservationClient from '../components/CarteReservationClient';
import { annulerReservation, recupererReservations } from '../reservation.api';
import { cleCible, useCiblesResolues } from '../reservation.cibles';
import { periodeReservation, type Periode } from '../reservation.service';
import type { Reservation } from '../reservation.types';

const PERIODES: Periode[] = ['a_venir', 'passee', 'annulee'];

function messageAnnulation(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' && detail.length > 0
    ? detail
    : textesCourants(TEXTES_RESERVATION).annulationEchouee;
}

export default function MesReservationsPage() {
  const t = useTextes(TEXTES_RESERVATION);
  const chargementSession = useChargementSession();
  const connecte = useEstConnecte();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Periode>('a_venir');
  // Figé au chargement : le classement ne bouge pas pendant que le client lit.
  const [maintenant] = useState(() => new Date());
  const cibles = useCiblesResolues(reservations);

  const charger = useCallback(() => {
    // Aucune requête avant que la session soit connue, ni si elle ne l'est
    // pas : elle reviendrait en 401, ce qui effacerait la session et
    // déclencherait une redirection pour quelqu'un qui n'était simplement pas
    // connecté.
    if (chargementSession || !connecte) {
      return undefined;
    }
    let actif = true;
    recupererReservations()
      .then((donnees) => actif && setReservations(donnees))
      .catch(() => actif && setErreur(t.nonChargees));
    return () => {
      actif = false;
    };
  }, [chargementSession, connecte, t.nonChargees]);

  useEffect(charger, [charger]);

  const parPeriode = useMemo(() => {
    const groupes: Record<Periode, Reservation[]> = {
      a_venir: [],
      passee: [],
      annulee: [],
    };
    for (const reservation of reservations ?? []) {
      groupes[periodeReservation(reservation, maintenant)].push(reservation);
    }
    // À venir : la plus proche d'abord. Passées et annulées : la plus récente.
    const debut = (r: Reservation) => new Date(r.date_debut).getTime();
    groupes.a_venir.sort((a, b) => debut(a) - debut(b));
    groupes.passee.sort((a, b) => debut(b) - debut(a));
    groupes.annulee.sort((a, b) => debut(b) - debut(a));
    return groupes;
  }, [reservations, maintenant]);

  async function annuler(idReservation: number): Promise<string | null> {
    try {
      await annulerReservation(idReservation);
      // Rechargement complet : annuler une formation annule aussi la
      // réservation d'hébergement liée, qui doit changer de rubrique.
      setReservations(await recupererReservations());
      return null;
    } catch (erreurAppel) {
      return messageAnnulation(erreurAppel);
    }
  }

  if (chargementSession) {
    return null;
  }

  if (!connecte) {
    return (
      <section className="mx-auto max-w-lg py-12 text-center">
        <CalendarDays size={40} aria-hidden className="mx-auto text-primaire" />
        <h1 className="mt-4 text-3xl font-semibold text-gris-700">
          {t.mesReservations}
        </h1>
        <p className="mt-2 text-gris-500">{t.connectezVousReservations}</p>
        <Link
          to="/connexion"
          className="mt-6 inline-block rounded-full bg-action px-6 py-3 font-semibold text-white no-underline hover:bg-action-fonce"
        >
          {t.seConnecter}
        </Link>
      </section>
    );
  }

  const courant = t.onglets[onglet];
  const liste = parPeriode[onglet];

  return (
    <section>
      <h1 className="text-3xl font-semibold text-gris-700">{t.mesReservations}</h1>
      <p className="mt-1 text-gris-500">{t.sousTitre}</p>

      {erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger"
        >
          {erreur}
        </p>
      )}

      {reservations === null && erreur === null && (
        <p role="status" className="mt-4 text-gris-500">
          {t.chargement}
        </p>
      )}

      {reservations !== null && (
        <>
          <div
            role="tablist"
            aria-label={t.rubriques}
            className="mt-6 flex gap-1 overflow-x-auto border-b border-gris-200"
          >
            {PERIODES.map((periode) => {
              const actif = periode === onglet;
              return (
                <button
                  key={periode}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setOnglet(periode)}
                  className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    actif
                      ? 'border-primaire text-primaire'
                      : 'border-transparent text-gris-500 hover:text-gris-700'
                  }`}
                >
                  {t.onglets[periode].libelle}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      actif
                        ? 'bg-primaire text-sur-couleur'
                        : 'bg-gris-200 text-gris-600'
                    }`}
                  >
                    {parPeriode[periode].length}
                  </span>
                </button>
              );
            })}
          </div>

          {liste.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-gris-300 bg-surface p-10 text-center">
              <p className="text-gris-500">{courant.vide}</p>
              {onglet === 'a_venir' && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <LienDecouverte vers="/formations" icone={GraduationCap}>
                    {t.formations}
                  </LienDecouverte>
                  <LienDecouverte vers="/salles" icone={Building2}>
                    {t.salles}
                  </LienDecouverte>
                  <LienDecouverte vers="/logements" icone={BedDouble}>
                    {t.hebergements}
                  </LienDecouverte>
                </div>
              )}
            </div>
          ) : (
            <ul role="tabpanel" aria-label={courant.libelle} className="mt-6 space-y-4">
              {liste.map((reservation) => (
                <CarteReservationClient
                  key={reservation.id_reservation}
                  reservation={reservation}
                  cible={cibles.get(cleCible(reservation))}
                  maintenant={maintenant}
                  surAnnulation={annuler}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function LienDecouverte({
  vers,
  icone: Icone,
  children,
}: {
  vers: string;
  icone: typeof Building2;
  children: string;
}) {
  return (
    <Link
      to={vers}
      className="inline-flex items-center gap-2 rounded-full border border-gris-300 bg-surface px-4 py-2 text-sm font-medium text-gris-700 no-underline transition-colors hover:border-primaire hover:text-primaire"
    >
      <Icone size={16} aria-hidden />
      {children}
    </Link>
  );
}
