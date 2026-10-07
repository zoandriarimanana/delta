/**
 * Tunnel de commande : mode de réception, coordonnées si invité, validation.
 *
 * Deux colonnes, comme sur tout site marchand : à gauche ce que le client
 * renseigne, en étapes numérotées ; à droite ce qu'il achète, le total et le
 * bouton de validation (`ResumeCommande`).
 *
 * Après validation, l'invité est redirigé vers la page publique de sa commande —
 * une URL qu'il peut mettre en favori, plutôt qu'un UUID à recopier depuis un
 * écran de confirmation éphémère.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShoppingBag, UserRound } from 'lucide-react';

import { useEstConnecte } from '@/lib/useEstConnecte';

import ChoixReception from '../components/ChoixReception';
import ConfirmationCommande from '../components/ConfirmationCommande';
import EtapesCommande from '../components/EtapesCommande';
import ResumeCommande from '../components/ResumeCommande';
import { usePanier, useValidationCommande } from '../commande.hooks';
import { TYPE_PAR_MODE, type ModeReception } from '../commande.service';
import type { Commande } from '../commande.types';

const ID_FORMULAIRE = 'formulaire-commande';

const CLASSES_CHAMP =
  'mt-1 block w-full rounded-lg border border-gris-300 bg-white px-3 py-2.5 text-gris-700 focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20';

export default function TunnelCommandePage() {
  const panier = usePanier();
  const connecte = useEstConnecte();
  const { valider, envoi, erreur } = useValidationCommande();
  const naviguer = useNavigate();

  // Retrait par défaut : la commande n'est jamais bloquée par une adresse
  // manquante, et la livraison reste un choix explicite.
  const [mode, setMode] = useState<ModeReception>('retrait');
  const [adresse, setAdresse] = useState('');
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [confirmee, setConfirmee] = useState<Commande | null>(null);

  if (confirmee !== null) {
    return <ConfirmationCommande commande={confirmee} />;
  }

  if (panier.lignes.length === 0) {
    return (
      <section className="mx-auto max-w-lg py-12 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primaire/10 text-primaire">
          <ShoppingBag size={36} aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-gris-700">Commande</h1>
        <p className="mt-3 text-gris-500">
          Votre panier est vide, il n’y a rien à commander.
        </p>
        <Link
          to="/produits"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white no-underline shadow-md hover:bg-action-fonce"
        >
          Parcourir le catalogue
        </Link>
      </section>
    );
  }

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    const commande = await valider(
      TYPE_PAR_MODE[mode],
      connecte ? undefined : { nom_invite: nom, contact_invite: contact },
      mode === 'livraison' ? adresse : undefined
    );
    if (commande === null) {
      // Échec : le panier est intact, l'erreur est affichée, on reste ici.
      return;
    }
    if (commande.reference_publique !== null) {
      naviguer(`/commandes/invite/${commande.reference_publique}`, {
        replace: true,
      });
      return;
    }
    setConfirmee(commande);
  }

  return (
    <section>
      <EtapesCommande courante="Commande" />
      <h1 className="mt-6 text-3xl font-semibold text-gris-700">
        Finaliser ma commande
      </h1>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <form id={ID_FORMULAIRE} onSubmit={soumettre} className="space-y-6">
          <Etape numero={1} titre="Mode de réception">
            <ChoixReception
              mode={mode}
              adresse={adresse}
              surMode={setMode}
              surAdresse={setAdresse}
            />
          </Etape>

          <Etape numero={2} titre="Vos coordonnées">
            {connecte ? (
              <p className="flex items-center gap-2 text-sm text-gris-600">
                <UserRound size={18} aria-hidden className="text-succes" />
                Vous êtes connecté : la commande sera rattachée à votre compte et
                visible dans « Mes commandes ».
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gris-500">
                  Vous commandez sans compte. Ces informations nous permettent de vous
                  recontacter.{' '}
                  <Link to="/connexion" className="font-medium text-primaire">
                    Déjà client ? Se connecter
                  </Link>
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-gris-700">Nom</span>
                    <input
                      required
                      autoComplete="name"
                      value={nom}
                      onChange={(evenement) => setNom(evenement.target.value)}
                      className={CLASSES_CHAMP}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gris-700">
                      Téléphone ou e-mail
                    </span>
                    <input
                      required
                      autoComplete="tel"
                      value={contact}
                      onChange={(evenement) => setContact(evenement.target.value)}
                      className={CLASSES_CHAMP}
                    />
                  </label>
                </div>
              </div>
            )}
          </Etape>

          {erreur !== null && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
            >
              {erreur}
            </p>
          )}
        </form>

        <ResumeCommande
          lignes={panier.lignes}
          sousTotal={panier.total}
          avecLivraison={mode === 'livraison'}
          idFormulaire={ID_FORMULAIRE}
          envoi={envoi}
        />
      </div>
    </section>
  );
}

function Etape({
  numero,
  titre,
  children,
}: {
  numero: number;
  titre: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gris-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-gris-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primaire text-sm text-white">
          {numero}
        </span>
        {titre}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
