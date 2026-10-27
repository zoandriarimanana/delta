/**
 * Appel en flux de l'assistant : `fetch` simulé, corps découpé en morceaux
 * arbitraires — un événement SSE peut arriver coupé en deux.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { poserQuestionEnFlux } from './assistant.api';
import { ErreurAssistant } from './assistant.service';
import type { EvenementFlux } from './assistant.types';

function corpsEnMorceaux(...morceaux: string[]): ReadableStream<Uint8Array> {
  const encodeur = new TextEncoder();
  return new ReadableStream({
    start(controleur) {
      morceaux.forEach((morceau) => controleur.enqueue(encodeur.encode(morceau)));
      controleur.close();
    },
  });
}

describe('poserQuestionEnFlux', () => {
  const fetchSimule = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSimule);
    document.cookie = 'delta_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSimule.mockReset();
  });

  it('transmet les événements dans l’ordre, même coupés entre deux morceaux', async () => {
    fetchSimule.mockResolvedValue(
      new Response(
        corpsEnMorceaux(
          'data: {"jeton": "Bon"}\n\ndata: {"jet',
          'on": "jour"}\n\ndata: {"fin": true, "sources": []}\n\n'
        ),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      )
    );
    const recus: EvenementFlux[] = [];

    await poserQuestionEnFlux('Bonjour ?', (e) => recus.push(e));

    expect(recus).toEqual([
      { jeton: 'Bon' },
      { jeton: 'jour' },
      { fin: true, sources: [] },
    ]);
  });

  it('envoie les cookies, et le jeton CSRF quand une session existe', async () => {
    document.cookie = 'delta_csrf=jeton-de-test';
    fetchSimule.mockResolvedValue(new Response(corpsEnMorceaux(''), { status: 200 }));

    await poserQuestionEnFlux('Question ?', () => undefined);

    const [url, options] = fetchSimule.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/assistant\/question\/flux$/);
    expect(options.credentials).toBe('include');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      'jeton-de-test'
    );
    expect(JSON.parse(options.body as string)).toEqual({ question: 'Question ?' });
  });

  it('sans session, aucun en-tête CSRF n’est inventé', async () => {
    fetchSimule.mockResolvedValue(new Response(corpsEnMorceaux(''), { status: 200 }));

    await poserQuestionEnFlux('Question ?', () => undefined);

    const [, options] = fetchSimule.mock.calls[0] as [string, RequestInit];
    expect(options.headers as Record<string, string>).not.toHaveProperty(
      'X-CSRF-Token'
    );
  });

  it('lève une ErreurAssistant portant le message du 503', async () => {
    fetchSimule.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'L’assistant n’est pas disponible.' }), {
        status: 503,
      })
    );

    const promesse = poserQuestionEnFlux('Question ?', () => undefined);

    await expect(promesse).rejects.toBeInstanceOf(ErreurAssistant);
    await expect(promesse).rejects.toMatchObject({
      statut: 503,
      message: 'L’assistant n’est pas disponible.',
    });
  });

  it('l’assistant du personnel interroge son propre endpoint', async () => {
    fetchSimule.mockResolvedValue(new Response(corpsEnMorceaux(''), { status: 200 }));

    await poserQuestionEnFlux('Étapes ?', () => undefined, undefined, 'personnel');

    const [url] = fetchSimule.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/assistant\/personnel\/question\/flux$/);
  });
});
