import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearUnlockToken,
  fetchConfig,
  fetchDownloadUrl,
  fetchPack,
  fetchPacks,
  fetchStories,
  fetchStory,
  readUnlockToken,
  storeUnlockToken,
  unlockStory,
} from '../../src/showcase/api/showcaseApi';

/**
 * The public site's HTTP client, exercised against a stubbed `fetch` with the real
 * `sessionStorage` underneath: the unlock-token round trip (stored on unlock, sent on read,
 * cleared when useless) is the behaviour that matters, and it only shows with real storage.
 */

interface StubResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  headers: { get: (name: string) => string | null };
}

function respond({
  body,
  status = 200,
  etag = null,
  jsonThrows = false,
}: {
  body?: unknown;
  status?: number;
  etag?: string | null;
  jsonThrows?: boolean;
}): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jsonThrows ? () => Promise.reject(new Error('not json')) : () => Promise.resolve(body),
    headers: { get: (name: string) => (name === 'etag' ? etag : null) },
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
});

describe('unlock tokens', () => {
  it('stores, reads and clears a token scoped to one story', () => {
    expect(readUnlockToken('story-1')).toBeNull();

    storeUnlockToken('story-1', 'token-1');
    expect(readUnlockToken('story-1')).toBe('token-1');
    expect(readUnlockToken('story-2')).toBeNull();

    clearUnlockToken('story-1');
    expect(readUnlockToken('story-1')).toBeNull();
  });
});

describe('fetchConfig', () => {
  it('returns the public config', async () => {
    fetchMock.mockResolvedValue(
      respond({ body: { showcaseEnabled: true, serverVersion: '1.8.0' } }),
    );

    await expect(fetchConfig()).resolves.toEqual({
      showcaseEnabled: true,
      serverVersion: '1.8.0',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/public/config');
  });

  it('throws the message the API chose', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Showcase is off.' }, status: 503 }));

    await expect(fetchConfig()).rejects.toThrow('Showcase is off.');
  });

  it('falls back to the status when the error body carries no message', async () => {
    fetchMock.mockResolvedValue(respond({ body: { code: 'NOPE' }, status: 500 }));

    await expect(fetchConfig()).rejects.toThrow('Request failed (500).');
  });

  it('falls back to the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(respond({ status: 500, jsonThrows: true }));

    await expect(fetchConfig()).rejects.toThrow('Request failed (500).');
  });
});

describe('fetchStories', () => {
  it('returns the listing with its ETag and no precondition on the first call', async () => {
    fetchMock.mockResolvedValue(
      respond({ body: [{ storyId: 'story-1' }], etag: 'W/"showcase-1"' }),
    );

    const result = await fetchStories(null);

    expect(result).toEqual({ stories: [{ storyId: 'story-1' }], etag: 'W/"showcase-1"' });
    expect(fetchMock).toHaveBeenCalledWith('/api/public/stories', { headers: {} });
  });

  it('sends the previous ETag so an unchanged listing costs a 304', async () => {
    fetchMock.mockResolvedValue(respond({ status: 304 }));

    const result = await fetchStories('W/"showcase-1"');

    expect(result).toEqual({ stories: null, etag: 'W/"showcase-1"' });
    expect(fetchMock).toHaveBeenCalledWith('/api/public/stories', {
      headers: { 'If-None-Match': 'W/"showcase-1"' },
    });
  });

  it('throws the API message when the listing fails', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Boom.' }, status: 500 }));

    await expect(fetchStories(null)).rejects.toThrow('Boom.');
  });
});

describe('fetchStory', () => {
  it('fetches a story without credentials when no token is stored', async () => {
    fetchMock.mockResolvedValue(respond({ body: { storyId: 'story-1' } }));

    await fetchStory('story-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/public/stories/story-1', { headers: {} });
  });

  it('sends the stored unlock token for a protected story', async () => {
    storeUnlockToken('story-1', 'unlock-1');
    fetchMock.mockResolvedValue(respond({ body: { storyId: 'story-1' } }));

    await fetchStory('story-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/public/stories/story-1', {
      headers: { Authorization: 'Showcase unlock-1' },
    });
  });

  it('encodes the story id', async () => {
    fetchMock.mockResolvedValue(respond({ body: {} }));

    await fetchStory('story 1/2');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/public/stories/story%201%2F2');
  });

  it('throws the API message when the story cannot be read', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Not found.' }, status: 404 }));

    await expect(fetchStory('missing')).rejects.toThrow('Not found.');
  });
});

describe('unlockStory', () => {
  const detail = { storyId: 'story-1', snapshot: {}, owner: {}, versions: [] };

  it('posts the password, stores the issued token and returns the unlocked story', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ body: { token: 'unlock-1' } }))
      .mockResolvedValueOnce(respond({ body: detail }));

    const result = await unlockStory('story-1', 'sésamo');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/public/stories/story-1/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'sésamo' }),
    });
    expect(readUnlockToken('story-1')).toBe('unlock-1');
    expect(result).toEqual(detail);
    // The follow-up read carries the token that was just stored.
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/public/stories/story-1', {
      headers: { Authorization: 'Showcase unlock-1' },
    });
  });

  it('stores nothing when the password is wrong', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Wrong password.' }, status: 403 }));

    await expect(unlockStory('story-1', 'wrong')).rejects.toThrow('Wrong password.');
    expect(readUnlockToken('story-1')).toBeNull();
  });

  it('drops a token the server itself will not honour', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ body: { token: 'useless' } }))
      .mockResolvedValueOnce(respond({ body: { protected: true } }));

    await expect(unlockStory('story-1', 'sésamo')).rejects.toThrow('Could not open this story.');
    expect(readUnlockToken('story-1')).toBeNull();
  });
});

describe('fetchDownloadUrl', () => {
  it('requests the short-lived link with the unlock token', async () => {
    storeUnlockToken('story-1', 'unlock-1');
    fetchMock.mockResolvedValue(respond({ body: { url: '/api/public/dl/abc' } }));

    const url = await fetchDownloadUrl('story-1', 'pub-1');

    expect(url).toBe('/api/public/dl/abc');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/stories/story-1/publications/pub-1/download-url',
      { method: 'POST', headers: { Authorization: 'Showcase unlock-1' } },
    );
  });

  it('throws the API message when the link cannot be issued', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Gone.' }, status: 410 }));

    await expect(fetchDownloadUrl('story-1', 'pub-1')).rejects.toThrow('Gone.');
  });
});

describe('packs', () => {
  it('lists the public packs', async () => {
    fetchMock.mockResolvedValue(respond({ body: [{ id: 'pack-1' }] }));

    await expect(fetchPacks()).resolves.toEqual([{ id: 'pack-1' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/public/packs');
  });

  it('throws the API message when the pack listing fails', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Boom.' }, status: 500 }));

    await expect(fetchPacks()).rejects.toThrow('Boom.');
  });

  it('reads a pack by id', async () => {
    fetchMock.mockResolvedValue(respond({ body: { id: 'pack-1' } }));

    await expect(fetchPack('pack-1')).resolves.toEqual({ id: 'pack-1' });
    expect(fetchMock).toHaveBeenCalledWith('/api/public/packs/pack-1');
  });

  it('throws the API message when the pack cannot be read', async () => {
    fetchMock.mockResolvedValue(respond({ body: { message: 'Not found.' }, status: 404 }));

    await expect(fetchPack('missing')).rejects.toThrow('Not found.');
  });
});
