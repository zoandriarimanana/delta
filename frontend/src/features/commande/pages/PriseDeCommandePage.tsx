/**
 * Prise de commande par un membre du personnel, au comptoir ou à table.
 *
 * **Premier écran du projet réservé au personnel.** La route est gardée par
 * `RoutePersonnel` dans `App.tsx` — mais cette garde n'est **pas** la
 * protection : c'est `get_current_personnel` qui refuse la donnée, en 401. Un
 * frontend est du code exécuté chez l'utilisateur, il ne garantit rien.
 *
 * Trois différences avec le tunnel client, toutes voulues :
 *
 * - **le panier est local**, tenu par `usePriseDeCommande` dans un `useState`.
 *   `commande.panier.ts` persiste dans le navigateur pour qu'un client
 *   retrouve sa sélection ; un salarié qui enchaîne les commandes ne veut rien
 *   retrouver, et sur un poste partagé cela écraserait le panier du client ;
 * - **aucune adresse de livraison** n'est envoyée. C'est sa présence, et elle
 *   seule, qui déclenche une `LIVRAISON` ; le statut terminal sera `Servie`,
 *   lu dans `STATUT_TERMINAL` côté serveur ;
 * - **le jeton n'identifie pas l'acheteur.** Il identifie le salarié, que le
 *   serveur enregistre dans `id_personnel`. L'acheteur est déduit d'une
 *   réservation, ou nommé comme invité.
 */

import { useState } from 'react';

import BlocAcheteur from '../components/BlocAcheteur';
import RecapitulatifSaisie from '../components/RecapitulatifSaisie';
import SelecteurProduits from '../components/SelecteurProduits';
import { usePriseDeCommande } from '../commande.hooks';
import { formaterMontant, versCibleAcheteur } from '../commande.service';
import type { CheminAcheteur, Commande } from '../commande.types';

export default function PriseDeCommandePage() {
  const saisie = usePriseDeCommande();
  const [chemin, setChemin] = useState<CheminAcheteur>('reservation');
  const [reservation, setReservation] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [derniere, setDerniere] = useState<Commande | null>(null);

  const cible = versCibleAcheteur(chemin, reservation, nom, contact);
  const prete = cible !== null && saisie.lignes.length > 0;

  function reinitialiser() {
    // Rien ne survit d'une commande à la suivante : le panier est vidé par le
    // hook, les champs de l'acheteur ici. Un salarié qui enchaîne repart d'un
    // écran vierge.
    setReservation('');
    setNom('');
    setContact('');
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Prise de commande</h1>
      <p className="mt-2 text-sm text-slate-600">
        Commande sur place, à retirer au comptoir ou servie à table.
      </p>

      {derniere !== null && (
        <p
          role="status"
          className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          Commande n° {derniere.id_commande} enregistrée —{' '}
          {formaterMontant(derniere.montant_total)}.
          {derniere.reference_publique !== null && (
            <>
              {' '}
              Référence à communiquer à l’acheteur :{' '}
              <code>{derniere.reference_publique}</code>
            </>
          )}
        </p>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Articles</h2>
          <div className="mt-3">
            <SelecteurProduits surAjout={saisie.ajouter} />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-slate-900">Commande</h2>
          <div className="mt-3">
            <RecapitulatifSaisie
              lignes={saisie.lignes}
              total={saisie.total}
              surModification={saisie.modifier}
              surRetrait={saisie.retirer}
            />
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(evenement) => {
              evenement.preventDefault();
              if (cible === null) {
                return;
              }
              void saisie.valider(cible).then((commande) => {
                if (commande !== null) {
                  setDerniere(commande);
                  reinitialiser();
                }
              });
            }}
          >
            <BlocAcheteur
              chemin={chemin}
              surChangementChemin={setChemin}
              reservation={reservation}
              surChangementReservation={setReservation}
              nom={nom}
              surChangementNom={setNom}
              contact={contact}
              surChangementContact={setContact}
            />

            {saisie.erreur !== null && (
              // Le message du serveur est repris tel quel : « Stock
              // insuffisant … » ou « Cette réservation est « En_attente » … »
              // disent au salarié quoi corriger.
              <p
                role="alert"
                className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {saisie.erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={saisie.envoi || !prete}
              className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saisie.envoi ? 'Enregistrement…' : 'Enregistrer la commande'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
