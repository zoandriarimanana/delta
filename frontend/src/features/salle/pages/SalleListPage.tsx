/**
 * Catalogue public des salles.
 *
 * Lecture ouverte : un visiteur doit pouvoir comparer les espaces avant de se
 * créer un compte. La réservation, elle, exige un jeton.
 */

import { useState } from 'react';
import { Link } from 'react-router';

import Carte from '@/components/ui/Carte';
import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { useImageCouverture } from '@/features/galerie/galerie.hooks';
import { imagePour } from '@/lib/images';
import { useTextes } from '@/lib/langue';

import { TEXTES_SALLE } from '../salle.textes';
import { useSalles } from '../salle.hooks';
import { libelleTarif } from '../salle.service';

export default function SalleListPage() {
  const image = useImageCouverture('salles');
  const t = useTextes(TEXTES_SALLE);
  const prix = useFormaterPrix();
  const [capacite, setCapacite] = useState<number | null>(null);
  const { donnees, chargement, erreur } = useSalles(capacite);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-primaire mb-2">
          {t.nosSalles}
        </h1>
        <p className="text-gris-600">{t.sousTitre}</p>
      </div>

      <div className="mb-8">
        <label
          htmlFor="filtre-capacite"
          className="block mb-2 font-medium text-gris-700"
        >
          {t.capaciteMin}
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
          className="w-32 rounded-lg border-2 border-gris-200 px-3 py-2 bg-surface text-gris-700 hover:border-primaire transition-colors"
          placeholder={t.personnesPlaceholder}
        />
      </div>

      {chargement && (
        <p role="status" className="text-center py-8 text-gris-500">
          {t.chargementSalles}
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
          <p className="text-gris-600 mb-4">{t.aucuneSalle}</p>
          <button
            onClick={() => setCapacite(null)}
            className="text-primaire hover:text-primaire-fonce font-medium transition-colors underline"
          >
            {t.voirToutes}
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
              image={image(salle.id_salle, imagePour('salle', salle.id_salle))}
              titre={salle.nom}
              description={t.personnes(salle.capacite)}
              pied={
                <p className="text-lg font-semibold text-primaire">
                  {libelleTarif(salle, prix)}
                </p>
              }
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
