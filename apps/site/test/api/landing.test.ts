import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLandingTiers,
  fetchLegalDocument,
  LandingApiError,
  sendContactMessage,
} from '../../src/api/landing';

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function respond(response: Partial<Response> & { ok: boolean; status: number }) {
  fetchMock.mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
}

describe('fetchLandingTiers', () => {
  it('returns what the server answers', async () => {
    respond({ ok: true, status: 200, json: async () => ({ currency: 'BRL', tiers: [] }) });

    await expect(fetchLandingTiers()).resolves.toEqual({ currency: 'BRL', tiers: [] });
  });

  it('refuses with the server message when it gives one', async () => {
    respond({ ok: false, status: 503, json: async () => ({ message: 'Warming up.' }) });

    const failure = await fetchLandingTiers().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LandingApiError);
    expect(failure).toMatchObject({ status: 503, message: 'Warming up.' });
  });

  it('says what the status was when the answer is not JSON, or carries no message', async () => {
    respond({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(fetchLandingTiers()).rejects.toMatchObject({
      status: 502,
      message: 'Request failed with status 502',
    });

    respond({ ok: false, status: 500, json: async () => ({ message: '' }) });
    await expect(fetchLandingTiers()).rejects.toMatchObject({
      message: 'Request failed with status 500',
    });
  });
});

describe('fetchLegalDocument', () => {
  const payload = {
    version: 2,
    updatedAt: '2026-10-12',
    en: [{ heading: 'Terms', paragraphs: ['Be kind.'] }],
    pt: [{ heading: 'Termos', paragraphs: ['Seja gentil.'] }],
  };

  it('returns the visitor language sections', async () => {
    respond({ ok: true, status: 200, json: async () => payload });

    await expect(fetchLegalDocument('/api/keres-tos', 'en')).resolves.toEqual({
      version: 2,
      updatedAt: '2026-10-12',
      sections: [{ heading: 'Terms', paragraphs: ['Be kind.'] }],
    });
    await expect(fetchLegalDocument('/api/keres-privacy', 'pt-BR')).resolves.toEqual({
      version: 2,
      updatedAt: '2026-10-12',
      sections: [{ heading: 'Termos', paragraphs: ['Seja gentil.'] }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/keres-tos',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });

  it('answers null on a predated server or an unusable payload', async () => {
    respond({ ok: false, status: 404, json: async () => ({}) });
    await expect(fetchLegalDocument('/api/keres-tos', 'en')).resolves.toBeNull();

    respond({ ok: true, status: 200, json: async () => ({ version: 'two' }) });
    await expect(fetchLegalDocument('/api/keres-tos', 'en')).resolves.toBeNull();

    respond({ ok: true, status: 200, json: async () => ({ version: 2, en: [] }) });
    await expect(fetchLegalDocument('/api/keres-tos', 'en')).resolves.toEqual(null);
  });

  it('refuses with the server message on a rejection', async () => {
    respond({ ok: false, status: 500, json: async () => ({ message: 'Down.' }) });

    await expect(fetchLegalDocument('/api/keres-privacy', 'en')).rejects.toMatchObject({
      name: 'LandingApiError',
      status: 500,
      message: 'Down.',
    });
  });
});

describe('sendContactMessage', () => {
  const message = { subject: 'Hi', body: 'Hello', contactEmail: 'a@b.co' };

  it('posts the message as JSON and returns the id', async () => {
    respond({ ok: true, status: 201, json: async () => ({ id: 'msg-1' }) });

    await expect(sendContactMessage(message)).resolves.toEqual({ id: 'msg-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/contact',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(message) }),
    );
  });

  it('refuses with the server message on a rejection', async () => {
    respond({ ok: false, status: 429, json: async () => ({ message: 'Slow down.' }) });

    await expect(sendContactMessage(message)).rejects.toMatchObject({
      name: 'LandingApiError',
      status: 429,
      message: 'Slow down.',
    });
  });
});
