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

interface Proprietes {
  sousTotal: number;
  avecLivraison: boolean;
}

export default function RecapitulatifMontants({
  sousTotal,
  avecLivraison,
}: Proprietes) {
  const prix = useFormaterPrix();
  const { tarif } = useTarifLivraison();
  const frais = avecLivraison && tarif !== null ? fraisLivraison(tarif, sousTotal) : 0;
  const reste =
    avecLivraison && tarif !== null ? resteAvantGratuite(tarif, sousTotal) : null;

  return (
    <dl className="space-y-1 rounded-xl border border-gris-200 bg-surface p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-gris-500">Produits</dt>
        <dd className="text-gris-700">{prix(sousTotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gris-500">Livraison</dt>
        <dd className="text-gris-700">
          {!avecLivraison
            ? 'Aucun frais'
            : tarif === null
              ? 'Calculée à la commande'
              : frais === 0
                ? 'Offerte'
                : prix(frais)}
        </dd>
      </div>
      {reste !== null && frais > 0 && (
        <p className="text-xs text-succes">
          Plus que {prix(reste)} d’achat pour une livraison offerte.
        </p>
      )}
      <div className="flex justify-between border-t border-gris-200 pt-2 text-base font-semibold text-gris-700">
        <dt>Total</dt>
        <dd>{prix(sousTotal + frais)}</dd>
      </div>
    </dl>
  );
}
