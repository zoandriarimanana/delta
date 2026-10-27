/**
 * Sous-total, livraison et total d'un panier, dans le tunnel.
 *
 * Les montants sont **indicatifs** : le serveur recalcule les prix et les
 * frais à la commande, et c'est son montant qui est enregistré.
 */

import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { useTarifLivraison } from '@/features/livraison/livraison.hooks';
import {
  fraisLivraison,
  resteAvantGratuite,
} from '@/features/livraison/livraison.service';
import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';

interface Proprietes {
  sousTotal: number;
  avecLivraison: boolean;
}

export default function RecapitulatifMontants({
  sousTotal,
  avecLivraison,
}: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const prix = useFormaterPrix();
  const { tarif } = useTarifLivraison();
  const frais = avecLivraison && tarif !== null ? fraisLivraison(tarif, sousTotal) : 0;
  const reste =
    avecLivraison && tarif !== null ? resteAvantGratuite(tarif, sousTotal) : null;

  return (
    <dl className="space-y-1 rounded-xl border border-gris-200 bg-surface p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-gris-500">{t.produits}</dt>
        <dd className="text-gris-700">{prix(sousTotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gris-500">{t.livraison}</dt>
        <dd className="text-gris-700">
          {!avecLivraison
            ? t.aucunFrais
            : tarif === null
              ? t.calculeeACommande
              : frais === 0
                ? t.offerte
                : prix(frais)}
        </dd>
      </div>
      {reste !== null && frais > 0 && (
        <p className="text-xs text-succes">{t.plusQueAchat(prix(reste))}</p>
      )}
      <div className="flex justify-between border-t border-gris-200 pt-2 text-base font-semibold text-gris-700">
        <dt>{t.total}</dt>
        <dd>{prix(sousTotal + frais)}</dd>
      </div>
    </dl>
  );
}
