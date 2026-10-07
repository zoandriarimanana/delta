/**
 * Base de connaissances : téléversement et liste des documents.
 *
 * Le fichier est lu, découpé et indexé **par le serveur** dès le
 * téléversement ; l'écran n'a qu'à rendre lisibles ses refus, repris tels
 * quels (format, taille, PDF scanné).
 */

import { useRef, useState, type FormEvent } from 'react';

import Badge from '@/components/ui/Badge';
import Bouton from '@/components/ui/Bouton';

import type { BaseDeConnaissances } from '../assistant.administration';
import type { DocumentConnaissance, PublicCible } from '../assistant.types';

const FORMATS_ACCEPTES = '.pdf,.docx,.txt,.md';
const CLASSES_ALERTE =
  'mt-3 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger';

const LIBELLES_PUBLIC: Record<PublicCible, string> = {
  Client: 'Clients',
  Personnel: 'Personnel',
};

/** « 1,2 Mo », « 340 ko » — lisible sans calcul. */
export function formaterTaille(octets: number): string {
  if (octets >= 1024 * 1024) {
    return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  }
  return `${Math.max(1, Math.round(octets / 1024))} ko`;
}

function etatIndexation(document: DocumentConnaissance) {
  if (document.supprime_le !== null) {
    return <Badge>Archivé</Badge>;
  }
  if (document.nombre_fragments === null) {
    return <Badge>Assistant coupé</Badge>;
  }
  if (document.nombre_fragments === 0) {
    // Enregistré, mais l'indexation a échoué : une réindexation le rattrape.
    return <Badge variante="negatif">Non indexé</Badge>;
  }
  return <Badge variante="positif">{document.nombre_fragments} fragment(s)</Badge>;
}

interface Proprietes {
  base: BaseDeConnaissances;
}

export default function PanneauDocuments({ base }: Proprietes) {
  const [titre, setTitre] = useState('');
  const [publicCible, setPublicCible] = useState<PublicCible>('Client');
  const [fichier, setFichier] = useState<File | null>(null);
  const [avecArchives, setAvecArchives] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  const visibles = base.documents.filter((d) => avecArchives || d.supprime_le === null);
  const nombreArchives = base.documents.filter((d) => d.supprime_le !== null).length;

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (fichier === null || titre.trim() === '') return;
    if (await base.televerser(titre.trim(), publicCible, fichier)) {
      setTitre('');
      setFichier(null);
      if (champFichier.current !== null) champFichier.current.value = '';
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-gris-200 bg-white p-4">
      <h2 className="text-lg font-medium text-gris-700">Base de connaissances</h2>
      <p className="mt-1 text-sm text-gris-500">
        Ajoutez des documents (PDF, Word, texte, Markdown — 5 Mio maximum) : ils sont
        lus, découpés et indexés automatiquement. Un document « Personnel » ne ressort
        jamais dans la bulle du site public.
      </p>

      <form
        onSubmit={(e) => void soumettre(e)}
        className="mt-4 grid gap-3 md:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-sm text-gris-700 md:col-span-2">
          Titre
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            maxLength={200}
            required
            placeholder="Ex. : Horaires et conditions de livraison"
            className="rounded border border-gris-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gris-700">
          Public
          <select
            value={publicCible}
            onChange={(e) => setPublicCible(e.target.value as PublicCible)}
            className="rounded border border-gris-300 px-2 py-1.5"
          >
            <option value="Client">{LIBELLES_PUBLIC.Client}</option>
            <option value="Personnel">{LIBELLES_PUBLIC.Personnel}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gris-700">
          Fichier
          <input
            ref={champFichier}
            type="file"
            accept={FORMATS_ACCEPTES}
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        <div className="md:col-span-4">
          <Bouton
            type="submit"
            disabled={base.envoi || fichier === null || titre.trim() === ''}
          >
            {base.envoi ? 'Indexation en cours…' : 'Téléverser'}
          </Bouton>
        </div>
      </form>

      {base.erreurAction !== null && (
        <p role="alert" className={CLASSES_ALERTE}>
          {base.erreurAction}
        </p>
      )}
      {base.erreur !== null && (
        <p role="alert" className={CLASSES_ALERTE}>
          {base.erreur}
        </p>
      )}

      <label className="mt-5 flex items-center gap-2 text-sm text-gris-700">
        <input
          type="checkbox"
          checked={avecArchives}
          onChange={(e) => setAvecArchives(e.target.checked)}
        />
        Afficher les archives ({nombreArchives})
      </label>

      {base.chargement && base.documents.length === 0 ? (
        <p role="status" className="mt-3 text-gris-500">
          Chargement…
        </p>
      ) : visibles.length === 0 ? (
        <p className="mt-3 text-sm text-gris-500">Aucun document pour le moment.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gris-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Titre</th>
                <th className="py-2 pr-3 font-medium">Public</th>
                <th className="py-2 pr-3 font-medium">Fichier</th>
                <th className="py-2 pr-3 font-medium">Index</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((document) => (
                <tr
                  key={document.id_document}
                  className="border-t border-gris-100 align-top"
                >
                  <td className="py-2 pr-3">
                    <p className="font-medium text-gris-700">{document.titre}</p>
                    <p className="line-clamp-2 text-xs text-gris-500">
                      {document.apercu}
                    </p>
                  </td>
                  <td className="py-2 pr-3 text-gris-700">
                    {LIBELLES_PUBLIC[document.public_cible]}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gris-600">
                    {document.nom_fichier}
                    <br />
                    {document.type_fichier.toUpperCase()} ·{' '}
                    {formaterTaille(document.taille_octets)}
                  </td>
                  <td className="py-2 pr-3">{etatIndexation(document)}</td>
                  <td className="py-2 text-right">
                    {document.supprime_le === null ? (
                      <Bouton
                        variante="secondaire"
                        disabled={base.envoi}
                        onClick={() => void base.archiver(document.id_document)}
                      >
                        Archiver
                      </Bouton>
                    ) : (
                      <Bouton
                        variante="secondaire"
                        disabled={base.envoi}
                        onClick={() => void base.restaurer(document.id_document)}
                      >
                        Restaurer
                      </Bouton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
