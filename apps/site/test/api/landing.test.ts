import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLandingTiers, LandingApiError, sendContactMessage } from '../../src/api/landing';

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
