/**
 * Catalogue public des salles.
 *
 * Lecture ouverte : un visiteur doit pouvoir comparer les espaces avant de se
 * créer un compte. La réservation, elle, exige un jeton.
 */

import { useState } from 'react';
import { Link } from 'react-router';

import Carte from '@/components/ui/Carte';
import { imagePour } from '@/lib/images';
import { useSalles } from '../salle.hooks';
import { libelleTarif } from '../salle.service';

export default function SalleListPage() {
  const [capacite, setCapacite] = useState<number | null>(null);
  const { donnees, chargement, erreur } = useSalles(capacite);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-primaire mb-2">Nos salles</h1>
        <p className="text-gris-600">
          Espaces de réunion, de formation et de réception
        </p>
      </div>

      <div className="mb-8">
        <label
          htmlFor="filtre-capacite"
          className="block mb-2 font-medium text-gris-700"
        >
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
          className="w-32 rounded-lg border-2 border-gris-200 px-3 py-2 bg-white text-gris-700 hover:border-primaire transition-colors"
          placeholder="Personnes"
        />
      </div>

      {chargement && (
        <p role="status" className="text-center py-8 text-gris-500">
          ⏳ Chargement des salles…
        </p>
      )}

      {erreur !== null && (
        <div
          role="alert"
          className="rounded-lg bg-danger/10 border-2 border-danger p-4 text-danger"
        >
          ⚠️ {erreur}
        </div>
      )}

      {donnees !== null && donnees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gris-600 mb-4">
            Aucune salle ne correspond à cette capacité.
          </p>
          <button
            onClick={() => setCapacite(null)}
            className="text-primaire hover:text-primaire-fonce font-medium transition-colors underline"
          >
            Voir toutes les salles
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(donnees ?? []).map((salle) => (
          <Link
            key={salle.id_salle}
            to={`/salles/${salle.id_salle}`}
            className="no-underline"
          >
            <Carte
              image={imagePour('salle', salle.id_salle)}
              titre={salle.nom}
              description={`${salle.capacite} personne(s)`}
              pied={
                <p className="text-lg font-semibold text-primaire">
                  {libelleTarif(salle)}
                </p>
              }
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
