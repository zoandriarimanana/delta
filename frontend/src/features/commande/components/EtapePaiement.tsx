/**
 * Étape « Paiement », juste après la validation d'une commande.
 *
 * Demande du 9 octobre 2026 : le client règle sa commande **dès la
 * validation**, par mobile money, qu'il ait un compte ou non. Ce bloc rappelle
 * la commande et son total, puis monte le formulaire du module `paiement` —
 * sans rien savoir de son fonctionnement, même mécanique que `FormulaireAvis`.
 *
 * Partagé par la confirmation d'un client connecté et la page d'une commande
 * invitée : seules la clé de paiement et la relecture du statut diffèrent.
 */

import { ShieldCheck } from 'lucide-react';

import {
  montantAPayer,
  montantDeviseEtrangere,
  montantEnAriary,
} from '@/features/devise/devise.service';
import FormulairePaiement from '@/features/paiement/components/FormulairePaiement';
import type { CiblePaiement } from '@/features/paiement/paiement.types';
import { useTextes } from '@/lib/langue';

import EcheancePaiement from './EcheancePaiement';
import { TEXTES_COMMANDE } from '../commande.textes';
import type { Commande } from '../commande.types';

interface Proprietes {
  commande: Commande;
  cible: CiblePaiement;
  lireStatutCommande: () => Promise<string>;
  surPaye: () => void;
}

export default function EtapePaiement({
  commande,
  cible,
  lireStatutCommande,
  surPaye,
}: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  // Le formulaire annonce ce que le moyen de paiement débitera (« 4,44 $ »
  // par carte) ; l'écran, lui, parle en Ariary.
  const montant = montantAPayer(commande);
  const enAriary = montantEnAriary(commande);
  const etranger = montantDeviseEtrangere(commande);

  return (
    <section
      aria-labelledby="titre-paiement"
      className="overflow-hidden rounded-2xl border border-gris-200 bg-surface shadow-sm"
    >
      <div className="border-b border-gris-200 bg-primaire/5 px-6 py-5">
        <h2 id="titre-paiement" className="text-xl font-semibold text-gris-700">
          {t.commandeNumeroEnregistree(commande.id_commande)}
        </h2>
        <p className="mt-1 text-sm text-gris-600">{t.plusQuUneEtape}</p>
        <EcheancePaiement paiementAvant={commande.paiement_avant} />
        <p className="mt-3 flex items-baseline justify-between">
          <span className="text-sm font-medium text-gris-600">{t.totalAPayer}</span>
          <span className="text-right">
            <span className="block text-2xl font-bold text-primaire">{enAriary}</span>
            {etranger !== null && (
              <span className="block text-xs text-gris-500">
                {t.soitParCarte(etranger)}
              </span>
            )}
          </span>
        </p>
      </div>

      <div className="px-6 py-6">
        <FormulairePaiement
          cible={cible}
          montant={montant}
          devise={commande.devise}
          numeroSuggere={commande.contact_invite ?? undefined}
          lireStatutCommande={lireStatutCommande}
          onConfirme={surPaye}
        />
      </div>

      <p className="flex items-center gap-2 border-t border-gris-200 px-6 py-3 text-xs text-gris-500">
        <ShieldCheck size={14} aria-hidden className="shrink-0 text-succes" />
        {cible.type === 'client' ? t.payerPlusTardCompte : t.payerPlusTardInvite}
      </p>
    </section>
  );
}
