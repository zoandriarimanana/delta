/**
 * Écran d'administration de l'assistant IA.
 *
 * Garanties : l'état est lisible, même assistant coupé ; la réindexation
 * demande confirmation ; un document se téléverse avec son public, et un
 * refus du serveur est repris tel quel ; un document non indexé se signale ;
 * la conversation bascule entre assistant du personnel et aperçu client ;
 * le 403 d'un salarié sans droit est rendu lisible.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiverDocument,
  lancerReindexation,
  poserQuestionEnFlux,
  recupererDocuments,
  recupererEtat,
  televerserDocument,
} from '../assistant.api';
import type { DocumentConnaissance } from '../assistant.types';
import AdministrationAssistantPage from './AdministrationAssistantPage';

vi.mock('../assistant.api');

const ETAT = {
  actif: true,
  llm_joignable: true,
  modele_llm: 'openai/gpt-oss-120b',
  modele_embeddings: 'BAAI/bge-m3',
  fragments_par_type: { produit: 12, salle: 3 },
  total_fragments: 15,
};

const DOCUMENT: DocumentConnaissance = {
  id_document: 7,
  titre: 'Conditions de livraison',
  nom_fichier: 'livraison.pdf',
  type_fichier: 'pdf',
  taille_octets: 245_760,
  public_cible: 'Client',
  date_ajout: '2026-10-05T08:00:00Z',
  id_personnel: 1,
  supprime_le: null,
  apercu: 'Livraison du lundi au samedi.',
  nombre_fragments: 4,
};

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationAssistantPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererDocuments).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('AdministrationAssistantPage', () => {
  it('affiche l’état et le contenu de l’index', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);

    afficher();

    expect(await screen.findByText('Activé')).toBeTruthy();
    expect(screen.getByText('Joignable')).toBeTruthy();
    expect(screen.getByText('BAAI/bge-m3')).toBeTruthy();
    expect(screen.getByText(/15 fragment\(s\) indexé\(s\)/)).toBeTruthy();
    expect(screen.getByText('Produit')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Base de connaissances' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Interroger l’assistant' })
    ).toBeTruthy();
  });

  it('assistant coupé : état lisible, sans téléversement ni conversation', async () => {
    vi.mocked(recupererEtat).mockResolvedValue({
      ...ETAT,
      actif: false,
      llm_joignable: false,
      fragments_par_type: {},
      total_fragments: 0,
    });

    afficher();

    expect(await screen.findByText('Désactivé')).toBeTruthy();
    const bouton = screen.getByRole('button', { name: 'Réindexer tout le catalogue' });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Base de connaissances' })).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Interroger l’assistant' })
    ).toBeNull();
  });

  it('réindexe après confirmation, puis rafraîchit l’état', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);
    vi.mocked(lancerReindexation).mockResolvedValue({
      par_type: { produit: { elements: 10, fragments: 12 } },
      total_fragments: 12,
    });
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Réindexer tout le catalogue' })
    );
    expect(lancerReindexation).not.toHaveBeenCalled();
    await utilisateur.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText(/Réindexation terminée : 12 fragment/)).toBeTruthy();
    await waitFor(() => expect(recupererEtat).toHaveBeenCalledTimes(2));
  });

  it('téléverse un document avec son titre et son public', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);
    vi.mocked(televerserDocument).mockResolvedValue({
      ...DOCUMENT,
      public_cible: 'Personnel',
    });
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.type(
      await screen.findByLabelText('Titre'),
      'Procédure de caisse'
    );
    await utilisateur.selectOptions(screen.getByLabelText('Public'), 'Personnel');
    const fichier = new File(['Compter le fond de caisse.'], 'caisse.txt', {
      type: 'text/plain',
    });
    await utilisateur.upload(screen.getByLabelText('Fichier'), fichier);
    await utilisateur.click(screen.getByRole('button', { name: 'Téléverser' }));

    await waitFor(() =>
      expect(televerserDocument).toHaveBeenCalledWith(
        'Procédure de caisse',
        'Personnel',
        fichier
      )
    );
    await waitFor(() => expect(recupererDocuments).toHaveBeenCalledTimes(2));
  });

  it('reprend tel quel le refus du serveur', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);
    vi.mocked(televerserDocument).mockRejectedValue({
      response: { status: 400, data: { detail: 'Aucun texte n’a pu être extrait.' } },
    });
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.type(await screen.findByLabelText('Titre'), 'Scan');
    await utilisateur.upload(
      screen.getByLabelText('Fichier'),
      new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })
    );
    await utilisateur.click(screen.getByRole('button', { name: 'Téléverser' }));

    expect(await screen.findByText('Aucun texte n’a pu être extrait.')).toBeTruthy();
  });

  it('liste les documents, signale un document non indexé, archive', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);
    vi.mocked(recupererDocuments).mockResolvedValue([
      DOCUMENT,
      { ...DOCUMENT, id_document: 8, titre: 'Menu de la semaine', nombre_fragments: 0 },
    ]);
    vi.mocked(archiverDocument).mockResolvedValue();
    const utilisateur = userEvent.setup();
    afficher();

    expect(await screen.findByText('Conditions de livraison')).toBeTruthy();
    expect(screen.getByText('4 fragment(s)')).toBeTruthy();
    expect(screen.getByText('Non indexé')).toBeTruthy();
    expect(screen.getAllByText(/PDF · 240 ko/)).toHaveLength(2);

    await utilisateur.click(screen.getAllByRole('button', { name: 'Archiver' })[0]!);
    expect(archiverDocument).toHaveBeenCalledWith(7);
  });

  it('la conversation bascule entre assistant du personnel et aperçu client', async () => {
    vi.mocked(recupererEtat).mockResolvedValue(ETAT);
    vi.mocked(poserQuestionEnFlux).mockResolvedValue();
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.click(
      await screen.findByRole('button', {
        name: 'Comment ajouter un nouveau produit au catalogue ?',
      })
    );
    expect(vi.mocked(poserQuestionEnFlux).mock.calls[0]?.[3]).toBe('personnel');

    await utilisateur.click(screen.getByRole('tab', { name: 'Aperçu côté client' }));
    await utilisateur.click(
      screen.getByRole('button', { name: 'Comment commander sans créer de compte ?' })
    );
    expect(vi.mocked(poserQuestionEnFlux).mock.calls[1]?.[3]).toBe('client');
  });

  it('rend lisible le 403 d’un salarié sans droit', async () => {
    vi.mocked(recupererEtat).mockRejectedValue({
      response: { status: 403, data: { detail: 'Droits insuffisants.' } },
    });

    afficher();

    expect(
      await screen.findByText('Cette action est réservée aux administrateurs.')
    ).toBeTruthy();
  });
});
