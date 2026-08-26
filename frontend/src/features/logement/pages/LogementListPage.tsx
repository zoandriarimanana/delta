/**
 * Catalogue public des logements.
 *
 * Seuls les logements `Disponible` sont listés par défaut : un bien en
 * maintenance ou retiré de l'offre n'a rien à faire dans un catalogue de
 * réservation. Le filtre porte sur **l'état du bien**, jamais sur son
 * occupation — il n'existe pas de statut « Occupé » (cf. `docs/mld.md`).
 */

import { useState } from 'react';
import { Link } from 'react-router';

import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { getImageUrl } from '@/lib/images';
import { formaterMontant } from '@/features/commande/commande.service';

import { useLogements } from '../logement.hooks';

export default function LogementListPage() {
  const [capacite, setCapacite] = useState<number | null>(null);
  const { donnees, chargement, erreur } = useLogements('Disponible', capacite);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-terracotta mb-2">Nos hébergements</h1>
        <p className="text-warm-gray-600">Chambres disponibles à la nuitée, sur place</p>
      </div>

      <div className="mb-8">
        <label htmlFor="filtre-capacite" className="block mb-2 font-medium text-warm-gray-700">
          Capacité minimale
        </label>
        <input
          id="filtre-capacite"
          type="number"
          min={1}
          value={capacite ?? ''}
          onChange={(evenement) => {
            const saisie = Number(evenement.target.value);
            setCapacite(Number.isInteger(saisie) && saisie > 0 ? saisie : null);
          }}
          className="w-32 rounded-lg border-2 border-warm-gray-200 px-3 py-2 bg-white text-warm-gray-700 hover:border-terracotta transition-colors"
          placeholder="Personnes"
        />
      </div>

      {chargement && (
        <p role="status" className="text-center py-8 text-warm-gray-500">
          ⏳ Chargement des hébergements…
        </p>
      )}

      {erreur !== null && (
        <div
          role="alert"
          className="rounded-lg bg-terracotta bg-opacity-10 border-2 border-terracotta p-4 text-terracotta"
        >
          ⚠️ {erreur}
        </div>
      )}

      {donnees !== null && donnees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-warm-gray-600 mb-4">Aucun hébergement ne correspond à cette capacité.</p>
          <button
            onClick={() => setCapacite(null)}
            className="text-terracotta hover:text-burgundy font-medium transition-colors underline"
          >
            Voir tous les hébergements
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(donnees ?? []).map((logement) => (
          <Link key={logement.id_logement} to={`/logements/${logement.id_logement}`} className="no-underline">
            <Card
              image={getImageUrl('logement')}
              title={`Chambre ${logement.type_chambre}`}
              description={`${logement.capacite} personne(s)`}
              footer={
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-terracotta">
                    {formaterMontant(logement.tarif_nuitee)} / nuit
                  </span>
                  <Badge status="disponible" />
                </div>
              }
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
