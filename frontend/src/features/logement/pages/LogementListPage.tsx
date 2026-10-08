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

import Badge from '@/components/ui/Badge';
import Carte from '@/components/ui/Carte';
import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { imagePour } from '@/lib/images';
import { useTextes } from '@/lib/langue';

import { TEXTES_LOGEMENT } from '../logement.textes';
import { libelleStatut, varianteStatut } from '../logement.service';
import { useLogements } from '../logement.hooks';

export default function LogementListPage() {
  const t = useTextes(TEXTES_LOGEMENT);
  const prix = useFormaterPrix();
  const [capacite, setCapacite] = useState<number | null>(null);
  const { donnees, chargement, erreur } = useLogements('Disponible', capacite);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-primaire mb-2">
          {t.nosHebergements}
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
          {t.chargement}
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
          <p className="text-gris-600 mb-4">{t.aucun}</p>
          <button
            onClick={() => setCapacite(null)}
            className="text-primaire hover:text-primaire-fonce font-medium transition-colors underline"
          >
            {t.voirTous}
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(donnees ?? []).map((logement) => (
          <Link
            key={logement.id_logement}
            to={`/logements/${logement.id_logement}`}
            className="no-underline"
          >
            <Carte
              image={imagePour('logement', logement.id_logement)}
              titre={t.chambre(logement.type_chambre)}
              description={t.personnes(logement.capacite)}
              pied={
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-primaire">
                    {t.parNuit(prix(logement.tarif_nuitee))}
                  </span>
                  {/* Le libellé et la variante viennent du module : la
                      pastille ne sait rien des logements. */}
                  <Badge variante={varianteStatut(logement.statut)}>
                    {libelleStatut(logement.statut)}
                  </Badge>
                </div>
              }
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
