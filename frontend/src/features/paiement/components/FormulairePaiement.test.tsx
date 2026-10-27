/**
 * Tests du parcours de paiement : choix, attente de validation, résultat.
 *
 * Ce qui porte l'essentiel :
 *
 * - le **numéro décide de l'opérateur** (034 → MVola, 032 → Orange Money,
 *   033 → Airtel Money) : le client ne peut pas envoyer une combinaison que
 *   le serveur refuserait, et le bouton reste fermé tant que le numéro est
 *   incomplet ;
 * - le numéro part **sans espaces**, à 10 chiffres ; jamais aucun montant ;
 * - un **invité** paie par sa référence, un client connecté par son
 *   identifiant de commande ;
 * - après l'envoi, l'écran **attend la validation sur le téléphone** et voit
 *   arriver la confirmation en relisant le statut de la commande ;
 * - hors Ariary, seule la carte est proposée ;
 * - le bouton de simulation est masqué hors développement (confort
 *   d'affichage, la vraie garantie est le 404 du serveur).
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INTERVALLE_RELECTURE_MS } from '../paiement.hooks';
import { initierPaiement, simulerConfirmation } from '../paiement.api';
import type { CiblePaiement, Paiement } from '../paiement.types';
import FormulairePaiement from './FormulairePaiement';

vi.mock('../paiement.api');

const CLIENT: CiblePaiement = { type: 'client', idCommande: 42 };
const INVITE: CiblePaiement = { type: 'invite', reference: 'ref-uuid' };

const EN_ATTENTE: Paiement = {
  id_paiement: 1,
  montant: '20000.00',
  methode: 'Mobile_money',
  fournisseur: 'Mvola',
  statut: 'En_attente',
  reference_externe: 'SIM-abc',
  date_paiement: '2026-10-12T10:00:00Z',
  id_commande: 42,
};

function afficher(extra: Partial<Parameters<typeof FormulairePaiement>[0]> = {}) {
  return render(
    <FormulairePaiement cible={CLIENT} montant="20 000,00 Ar" {...extra} />
  );
}

async function saisirNumero(numero: string) {
  await userEvent.type(screen.getByLabelText(/numéro mobile money/i), numero);
}

beforeEach(() => {
  vi.stubEnv('VITE_ENVIRONMENT', 'developpement');
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('choix de l’opérateur', () => {
  it('propose les trois opérateurs, MVola par défaut', () => {
    afficher();

    expect(screen.getByRole('radio', { name: /mvola/i })).toHaveProperty(
      'checked',
      true
    );
    expect(screen.getByRole('radio', { name: /orange money/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /airtel money/i })).toBeTruthy();
  });

  it('sélectionne l’opérateur d’après le numéro saisi', async () => {
    afficher();

    await saisirNumero('0321234567');

    expect(screen.getByRole('radio', { name: /orange money/i })).toHaveProperty(
      'checked',
      true
    );
    expect(screen.getByText(/numéro orange money détecté/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /avec orange money/i })).toBeTruthy();
  });

  it('met le numéro en forme et garde le bouton fermé tant qu’il est incomplet', async () => {
    afficher();

    await saisirNumero('03412');

    expect(screen.getByLabelText(/numéro mobile money/i)).toHaveProperty(
      'value',
      '034 12'
    );
    expect(screen.getByRole('button', { name: /payer 20 000,00 ar/i })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('signale un numéro qui ne correspond à aucun opérateur', async () => {
    afficher();

    await saisirNumero('0391234567');

    expect(screen.getByText(/aucun opérateur mobile money/i)).toBeTruthy();
  });

  it('reprend le numéro de contact d’un invité s’il est mobile', () => {
    afficher({ numeroSuggere: '+261 33 12 345 67' });

    expect(screen.getByLabelText(/numéro mobile money/i)).toHaveProperty(
      'value',
      '033 12 345 67'
    );
    expect(screen.getByRole('radio', { name: /airtel money/i })).toHaveProperty(
      'checked',
      true
    );
  });
});

describe('envoi', () => {
  it('envoie l’opérateur et le numéro sans espaces, jamais de montant', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    afficher();

    await saisirNumero('034 12 345 67');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    expect(initierPaiement).toHaveBeenCalledWith(CLIENT, {
      methode: 'Mobile_money',
      fournisseur: 'Mvola',
      numero_mobile_money: '0341234567',
    });
  });

  it('un invité paie par la référence de sa commande', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    render(<FormulairePaiement cible={INVITE} montant="20 000,00 Ar" />);

    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    expect(vi.mocked(initierPaiement).mock.calls[0]?.[0]).toEqual(INVITE);
  });

  it('reprend tel quel le refus du serveur', async () => {
    vi.mocked(initierPaiement).mockRejectedValue({
      response: { status: 409, data: { detail: 'Cette commande a déjà été payée.' } },
    });
    afficher();

    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('déjà été payée');
  });

  it('rend lisible une erreur de validation du numéro (422)', async () => {
    vi.mocked(initierPaiement).mockRejectedValue({
      response: {
        status: 422,
        data: { detail: [{ msg: "Value error, Ce numéro n'est pas un numéro MVola" }] },
      },
    });
    afficher();

    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Ce numéro n'est pas un numéro MVola"
    );
  });
});

describe('attente de la validation', () => {
  it('demande de valider sur le téléphone, avec le numéro et l’opérateur', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    afficher();

    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    expect(
      await screen.findByText(/validez le paiement sur votre téléphone/i)
    ).toBeTruthy();
    expect(screen.getByText(/034 12 345 67 \(MVola\)/)).toBeTruthy();
    expect(screen.getByText(/en attente de la confirmation de mvola/i)).toBeTruthy();
  });

  it('voit arriver la confirmation en relisant le statut de la commande', async () => {
    // Faux minuteurs dès le départ : l'intervalle de relecture est créé à
    // l'envoi, il doit naître sous leur contrôle.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    const lireStatut = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('En_attente')
      .mockResolvedValue('Confirmee');
    const onConfirme = vi.fn();
    afficher({ lireStatutCommande: lireStatut, onConfirme });
    await utilisateur.type(screen.getByLabelText(/numéro mobile money/i), '0341234567');
    await utilisateur.click(screen.getByRole('button', { name: /avec mvola/i }));
    await screen.findByText(/validez le paiement/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALLE_RELECTURE_MS * 2 + 10);
    });

    expect(await screen.findByText(/paiement reçu/i)).toBeTruthy();
    expect(lireStatut).toHaveBeenCalledTimes(2);
    expect(onConfirme).toHaveBeenCalledOnce();
  });

  it('la simulation (développement) confirme le paiement', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    vi.mocked(simulerConfirmation).mockResolvedValue({
      ...EN_ATTENTE,
      statut: 'Reussi',
    });
    const onConfirme = vi.fn();
    afficher({ onConfirme });
    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    await userEvent.click(await screen.findByRole('button', { name: /simuler/i }));

    expect(simulerConfirmation).toHaveBeenCalledWith(CLIENT, 1);
    expect(await screen.findByText(/paiement reçu/i)).toBeTruthy();
    await waitFor(() => expect(onConfirme).toHaveBeenCalledOnce());
  });

  it('masque la simulation hors développement', async () => {
    vi.stubEnv('VITE_ENVIRONMENT', 'production');
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    afficher();
    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    await screen.findByText(/validez le paiement/i);
    expect(screen.queryByRole('button', { name: /simuler/i })).toBeNull();
  });

  it('un échec propose de réessayer, et revient au choix', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    vi.mocked(simulerConfirmation).mockResolvedValue({
      ...EN_ATTENTE,
      statut: 'Echoue',
    });
    afficher();
    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));
    await userEvent.click(await screen.findByRole('button', { name: /simuler/i }));

    expect(await screen.findByText(/n’a pas abouti/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /réessayer/i }));
    expect(screen.getByLabelText(/numéro mobile money/i)).toBeTruthy();
  });

  it('« changer de numéro » revient au choix', async () => {
    vi.mocked(initierPaiement).mockResolvedValue(EN_ATTENTE);
    afficher();
    await saisirNumero('0341234567');
    await userEvent.click(screen.getByRole('button', { name: /avec mvola/i }));

    await userEvent.click(
      await screen.findByRole('button', { name: /changer de numéro/i })
    );

    expect(screen.getByLabelText(/numéro mobile money/i)).toBeTruthy();
  });
});

describe('carte bancaire', () => {
  it('reste proposée en Ariary, et passe toujours par Stripe', async () => {
    vi.mocked(initierPaiement).mockResolvedValue({
      ...EN_ATTENTE,
      methode: 'Carte',
      fournisseur: 'Stripe',
    });
    afficher();

    await userEvent.click(screen.getByRole('button', { name: /plutôt par carte/i }));
    await userEvent.click(screen.getByRole('button', { name: /par carte$/i }));

    expect(initierPaiement).toHaveBeenCalledWith(CLIENT, {
      methode: 'Carte',
      fournisseur: 'Stripe',
    });
  });

  it('est le seul choix pour une commande en devise', () => {
    afficher({ devise: 'EUR', montant: '4,00 €' });

    expect(screen.getByText(/ne fonctionne qu’en ariary/i)).toBeTruthy();
    expect(screen.queryByLabelText(/numéro mobile money/i)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /plutôt par mobile money/i })
    ).toBeNull();
  });
});
