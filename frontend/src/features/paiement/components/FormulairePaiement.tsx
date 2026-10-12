/**
 * Paiement d'une commande : choix du moyen, attente de validation, résultat.
 *
 * Vit dans `features/paiement/`, jamais dans `commande/` : c'est une écriture
 * sur `PAIEMENT`, entité à part entière. Les écrans de commande le montent
 * sans rien savoir de son implémentation — juste après la validation (client
 * connecté **et invité**, demande du 9 octobre 2026), et dans « Mes
 * commandes » pour une commande encore en attente.
 *
 * **Mobile money d'abord** (MVola, Orange Money, Airtel Money) : c'est le
 * moyen de paiement des clients de Delta. La carte bancaire internationale
 * reste proposée, et devient le seul choix pour une commande en devise — le
 * mobile money n'opère qu'en Ariary, le serveur le refuse sinon.
 *
 * **Deux temps** : la plateforme envoie la demande, le client la valide sur
 * son téléphone. La confirmation arrive au serveur par webhook ; l'écran
 * relit le statut de la commande (`lireStatutCommande`) jusqu'à la voir
 * confirmée.
 *
 * Le bouton de simulation est masqué hors `VITE_ENVIRONMENT=developpement` —
 * **confort d'affichage seulement** : la vraie garantie est le 404 du serveur
 * hors développement (`Settings.ENVIRONMENT`, cf. `docs/mld.md`).
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

import type { Devise } from '@/features/devise/devise.types';
import { useTextes } from '@/lib/langue';

import { useAttenteConfirmation, usePaiement } from '../paiement.hooks';
import { formaterNumero, infoOperateur, type Operateur } from '../paiement.service';
import { TEXTES_PAIEMENT } from '../paiement.textes';
import type { CiblePaiement, PaiementEnvoye } from '../paiement.types';
import AttenteValidation from './AttenteValidation';
import ChoixMoyenPaiement from './ChoixMoyenPaiement';

interface Proprietes {
  cible: CiblePaiement;
  /** Montant à payer, déjà mis en forme dans la devise de la commande. */
  montant: string;
  /** Devise de la commande : hors Ariary, seule la carte est possible. */
  devise?: Devise;
  /** Numéro proposé d'office (le contact d'un invité, s'il est mobile). */
  numeroSuggere?: string;
  /** Relit le statut de la commande, pour voir arriver la confirmation. */
  lireStatutCommande?: () => Promise<string>;
  /** Appelé une fois, quand le paiement est confirmé. */
  onConfirme?: () => void;
}

/** Lu à chaque rendu, jamais figé au chargement du module (`vi.stubEnv`). */
function simulationActive(): boolean {
  return import.meta.env.VITE_ENVIRONMENT === 'developpement';
}

export default function FormulairePaiement({
  cible,
  montant,
  devise = 'MGA',
  numeroSuggere,
  lireStatutCommande,
  onConfirme,
}: Proprietes) {
  const t = useTextes(TEXTES_PAIEMENT);
  const { paiement, envoi, erreur, initier, simuler, recommencer } = usePaiement(cible);
  const [envoye, setEnvoye] = useState<PaiementEnvoye | null>(null);
  const enAttente = paiement?.statut === 'En_attente';
  const { confirmee, expire } = useAttenteConfirmation(enAttente, lireStatutCommande);
  const reussi = paiement?.statut === 'Reussi' || confirmee;

  // Prévenir l'appelant une seule fois : `onConfirme` recharge souvent la
  // page appelante, qui recrée la fonction — sans garde, la boucle tourne.
  const dejaNotifie = useRef(false);
  useEffect(() => {
    if (reussi && !dejaNotifie.current) {
      dejaNotifie.current = true;
      onConfirme?.();
    }
  }, [reussi, onConfirme]);

  if (reussi) {
    return (
      <div role="status" className="space-y-2 py-4 text-center">
        <CheckCircle2 size={48} aria-hidden className="mx-auto text-succes" />
        <p className="text-lg font-semibold text-gris-700">{t.reussi}</p>
        <p className="text-sm text-gris-500">{t.merci}</p>
      </div>
    );
  }

  if (paiement?.statut === 'Echoue') {
    return (
      <div role="alert" className="space-y-3 py-4 text-center">
        <XCircle size={48} aria-hidden className="mx-auto text-danger" />
        <p className="text-lg font-semibold text-gris-700">{t.echoue}</p>
        <p className="text-sm text-gris-500">{t.echoueDetail}</p>
        <button
          type="button"
          onClick={recommencer}
          className="rounded-full bg-action px-6 py-2.5 font-semibold text-white hover:bg-action-fonce"
        >
          {t.reessayer}
        </button>
      </div>
    );
  }

  if (enAttente && envoye !== null) {
    const mobile = envoye.methode === 'Mobile_money';
    return (
      <AttenteValidation
        montant={montant}
        numero={mobile ? formaterNumero(envoye.numero_mobile_money ?? '') : null}
        nomOperateur={
          mobile ? infoOperateur(envoye.fournisseur as Operateur).nom : 'Stripe'
        }
        expire={expire}
        simulation={simulationActive()}
        envoi={envoi}
        surSimulation={() => void simuler()}
        surRecommencer={recommencer}
      />
    );
  }

  return (
    <ChoixMoyenPaiement
      montant={montant}
      enAriary={devise === 'MGA'}
      numeroSuggere={numeroSuggere}
      envoi={envoi}
      erreur={erreur}
      surEnvoi={(donnees) => {
        setEnvoye(donnees);
        void initier(donnees);
      }}
    />
  );
}
