/**
 * Administration des commandes, tous clients confondus (Sprint 10.6).
 *
 * Réservée au personnel par `RoutePersonnel` — mais **ce n'est pas la
 * protection** : `get_current_personnel_administrateur` refuse la donnée côté
 * serveur.
 *
 * **Liste + fiche**, contrairement à `AdministrationReservationsPage`
 * (une seule page, actions en ligne) : les trois actions d'une commande
 * (annuler, relancer une livraison, marquer remboursée) ne sont pas de
 * simples transitions de statut interchangeables — chacune a ses propres
 * conditions d'apparition, et les regrouper en ligne aurait produit un
 * tableau illisible. C'est le même choix que PERSONNEL et ABONNEMENT.
 *
 * Le filtre par statut est **côté client** : `GET /commandes/administration`
 * ne porte aucun paramètre de filtre (cf. `commande.api.ts`).
 *
 * **Panneau « Abonnements » et panneau « Réservations » : de simples liens**
 * vers les écrans déjà livrés (7.3 et 10.3), pas une nouvelle page agrégée —
 * décision actée dans le scope de cette tâche. Un tableau de bord commun aux
 * trois domaines resterait à construire le jour où le besoin se manifeste.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import Badge from '@/components/ui/Badge';

import {
  formaterDate,
  formaterMontant,
  libelleModeReception,
  libelleStatutCommande,
  varianteStatutCommande,
} from '../commande.service';
import { useCommandesAdministration } from '../commande.administration';
import type { Commande, StatutCommande } from '../commande.types';

const STATUTS: StatutCommande[] = [
  'En_attente',
  'Confirmee',
  'En_preparation',
  'Livree',
  'Servie',
  'Annulee',
];

export default function AdministrationCommandesPage() {
  const donnees = useCommandesAdministration();
  const [filtreStatut, setFiltreStatut] = useState<StatutCommande | ''>('');

  const commandesFiltrees = useMemo(
    () =>
      donnees.commandes.filter((c) => filtreStatut === '' || c.statut === filtreStatut),
    [donnees.commandes, filtreStatut]
  );

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gris-700">
        Administration des commandes
      </h1>

      <nav className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link to="/personnel/abonnements" className="text-primaire underline">
          Voir les abonnements
        </Link>
        <Link to="/personnel/reservations" className="text-primaire underline">
          Voir les réservations
        </Link>
      </nav>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gris-700">
          Statut
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as StatutCommande | '')}
            className="rounded border border-gris-300 px-2 py-1"
          >
            <option value="">Tous</option>
            {STATUTS.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleStatutCommande(valeur)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {donnees.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {donnees.erreur}
        </p>
      )}

      {donnees.chargement && (
        <p role="status" className="mt-6 text-gris-500">
          Chargement…
        </p>
      )}

      {!donnees.chargement && commandesFiltrees.length === 0 && (
        <p className="mt-6 text-gris-600">Aucune commande à afficher.</p>
      )}

      {commandesFiltrees.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl bg-surface shadow-sm">
            <thead>
              <tr className="border-b border-gris-200 text-left">
                <th className="px-3 py-2 text-sm font-medium text-gris-600">
                  Commande
                </th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Date</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Type</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Montant</th>
                <th className="px-3 py-2 text-sm font-medium text-gris-600">Statut</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-200">
              {commandesFiltrees.map((commande) => (
                <LigneCommande key={commande.id_commande} commande={commande} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LigneCommande({ commande }: { commande: Commande }) {
  return (
    <tr>
      <td className="px-3 py-2 text-sm text-gris-700">
        Commande n° {commande.id_commande}
      </td>
      <td className="px-3 py-2 text-sm text-gris-600">
        {formaterDate(commande.date_commande)}
      </td>
      <td className="px-3 py-2 text-sm text-gris-700">
        {libelleModeReception(commande.type_commande)}
      </td>
      <td className="px-3 py-2 text-sm text-gris-700">
        {formaterMontant(commande.montant_total)}
      </td>
      <td className="px-3 py-2 text-sm text-gris-700">
        <Badge variante={varianteStatutCommande(commande.statut)}>
          {libelleStatutCommande(commande.statut)}
        </Badge>
        {commande.rembourse_le !== null && (
          <span className="ml-2 text-xs text-gris-500">(remboursée)</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          to={`/personnel/commandes/administration/${commande.id_commande}`}
          className="text-sm text-primaire underline"
        >
          Voir le détail
        </Link>
      </td>
    </tr>
  );
}
