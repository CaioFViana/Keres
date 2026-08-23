const mockConnectivity = {
  reportReachable: jest.fn(),
  reportUnreachable: jest.fn(),
};

jest.mock('../../src/state/connectivityStore', () => ({
  useConnectivityStore: { getState: () => mockConnectivity },
}));

import { AxiosError, type AxiosRequestConfig } from 'axios';
import {
  apiBaseUrl,
  apiUrl,
  clearAllServerAuthState,
  clearServerTokenCache,
  createKeresAxiosInstance,
  getServerAccessToken,
  isOfflineError,
  updateServerTokenCache,
  type TokenProvider,
} from '../../src/services/apiClient';

const SERVER = { id: 'server-1', name: 'Casa', url: 'http://localhost:3000' } as any;

type Reply = { status: number; data?: unknown } | { networkError: string } | { timeout: true };

/**
 * Instância com um adapter roteirizado: cada requisição consome a próxima resposta da fila,
 * o que permite exercitar o fluxo real do axios (ordem dos interceptors, retry) em vez de
 * chamar os interceptors à mão.
 */
function buildInstance(replies: Reply[]) {
  const instance = createKeresAxiosInstance({ baseURL: SERVER.url });
  const seen: AxiosRequestConfig[] = [];
  const queue = [...replies];

  instance.defaults.adapter = async (config) => {
    seen.push(config);
    const reply = queue.shift() ?? { status: 200, data: {} };

    if ('networkError' in reply) {
      return Promise.reject(
        Object.assign(new AxiosError(reply.networkError, 'ERR_NETWORK', config as any), {
          request: {},
        }),
      );
    }
    if ('timeout' in reply) {
      return Promise.reject(
        Object.assign(new AxiosError('timeout of 0ms exceeded', 'ECONNABORTED', config as any), {
          request: {},
        }),
      );
    }
    if (reply.status >= 400) {
      return Promise.reject(
        Object.assign(
          new AxiosError(
            `Request failed with status code ${reply.status}`,
            undefined,
            config as any,
          ),
          {
            request: {},
            response: {
              status: reply.status,
              data: reply.data,
              config,
              headers: {},
              statusText: '',
            },
          },
        ),
      );
    }
    return { data: reply.data, status: reply.status, statusText: 'OK', headers: {}, config } as any;
  };

  instance.setActiveServer(SERVER);
  return { instance, seen };
}

function tokenProvider(overrides: Partial<TokenProvider> = {}): TokenProvider {
  return {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    getServerUrl: () => SERVER.url,
    refreshAccessToken: jest.fn(async () => ({
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
    })),
    clearAuth: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearServerTokenCache(SERVER.id);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  clearAllServerAuthState([SERVER.id]);
});

describe('isOfflineError', () => {
  it.each(['NO_RESPONSE', 'TIMEOUT', 'ERR_NETWORK', 'ECONNABORTED'])(
    'treats %s as the server being unreachable',
    (code) => {
      expect(isOfflineError({ code })).toBe(true);
    },
  );

  it.each([
    ['an HTTP error', { code: 'SERVER_ERROR_500' }],
    ['an error with no code', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'ERR_NETWORK'],
    ['a number', 42],
  ])('does not treat %s as offline', (_label, value) => {
    expect(isOfflineError(value)).toBe(false);
  });
});

describe('API URL contract', () => {
  it('keeps the persisted address at the origin and mounts calls below /api', () => {
    expect(apiBaseUrl('https://keres.example.com/')).toBe('https://keres.example.com/api');
    expect(apiUrl('https://keres.example.com', '/auth/login')).toBe(
      'https://keres.example.com/api/auth/login',
    );
  });
});

describe('server token cache', () => {
  it('hands out the access token for direct downloads that bypass axios', () => {
    updateServerTokenCache(SERVER.id, 'access-1', 'refresh-1');

    expect(getServerAccessToken(SERVER.id)).toBe('access-1');
  });

  it('returns null for a server it has never seen', () => {
    expect(getServerAccessToken('desconhecido')).toBeNull();
  });

  it('returns null after the entry is cleared', () => {
    updateServerTokenCache(SERVER.id, 'access-1', 'refresh-1');
    clearServerTokenCache(SERVER.id);

    expect(getServerAccessToken(SERVER.id)).toBeNull();
  });

  it('keeps servers apart, so a token never leaks across them', () => {
    updateServerTokenCache('server-a', 'token-a', 'refresh-a');
    updateServerTokenCache('server-b', 'token-b', 'refresh-b');

    expect(getServerAccessToken('server-a')).toBe('token-a');
    expect(getServerAccessToken('server-b')).toBe('token-b');

    clearAllServerAuthState(['server-a', 'server-b']);
  });
});

describe('request interceptor', () => {
  it('authenticates the request with the active server token', async () => {
    updateServerTokenCache(SERVER.id, 'access-1', 'refresh-1');
    const { instance, seen } = buildInstance([{ status: 200 }]);

    await instance.get('/stories');

    expect(seen[0].headers?.Authorization).toBe('Bearer access-1');
  });

  it('sends no credential when the server has no token cached', async () => {
    const { instance, seen } = buildInstance([{ status: 200 }]);

    await instance.get('/stories');

    expect(seen[0].headers?.Authorization).toBeUndefined();
  });

  it('sends no credential when no server is active', async () => {
    updateServerTokenCache(SERVER.id, 'access-1', 'refresh-1');
    const { instance, seen } = buildInstance([{ status: 200 }]);
    instance.setActiveServer(null);

    await instance.get('/stories');

    expect(seen[0].headers?.Authorization).toBeUndefined();
  });

  it.each(['/auth/login', '/auth/refresh'])(
    'never attaches the access token to %s',
    async (url) => {
      updateServerTokenCache(SERVER.id, 'access-1', 'refresh-1');
      const { instance, seen } = buildInstance([{ status: 200 }]);

      await instance.post(url, {});

      expect(seen[0].headers?.Authorization).toBeUndefined();
    },
  );

  it('does not overwrite an Authorization header the caller set', async () => {
    updateServerTokenCache(SERVER.id, 'access-1', 'refresh-1');
    const { instance, seen } = buildInstance([{ status: 200 }]);

    await instance.get('/stories', { headers: { Authorization: 'Bearer manual' } });

    expect(seen[0].headers?.Authorization).toBe('Bearer manual');
  });
});

describe('connectivity reporting', () => {
  it('marks the server reachable on a successful response', async () => {
    const { instance } = buildInstance([{ status: 200 }]);

    await instance.get('/kerescheck');

    expect(mockConnectivity.reportReachable).toHaveBeenCalledWith(SERVER.id, SERVER.name);
  });

  it('marks the server reachable on an HTTP error, since it answered', async () => {
    const { instance } = buildInstance([{ status: 404, data: { message: 'Not found.' } }]);

    await expect(instance.get('/stories/x')).rejects.toThrow();

    expect(mockConnectivity.reportReachable).toHaveBeenCalledWith(SERVER.id, SERVER.name);
    expect(mockConnectivity.reportUnreachable).not.toHaveBeenCalled();
  });

  it('marks the server unreachable when the request never got an answer', async () => {
    const { instance } = buildInstance([{ networkError: 'Network Error' }]);

    await expect(instance.get('/stories')).rejects.toThrow();

    expect(mockConnectivity.reportUnreachable).toHaveBeenCalledWith(SERVER.id, SERVER.name);
  });

  it('does not report anything for an absolute URL aimed at another host', async () => {
    const { instance } = buildInstance([{ status: 200 }]);

    await instance.get('http://outro-servidor:9999/kerescheck');

    expect(mockConnectivity.reportReachable).not.toHaveBeenCalled();
    expect(mockConnectivity.reportUnreachable).not.toHaveBeenCalled();
  });
});

describe('error normalization', () => {
  it('relays the message the API chose, instead of a generic one', async () => {
    const { instance } = buildInstance([
      { status: 403, data: { message: 'Story limit reached for your plan' } },
    ]);

    await expect(instance.get('/stories')).rejects.toMatchObject({
      code: 'SERVER_ERROR_403',
      message: expect.stringContaining('Story limit reached for your plan'),
    });
  });

  it('falls back to a generic message when the API sent none', async () => {
    const { instance } = buildInstance([{ status: 500, data: {} }]);

    await expect(instance.get('/stories')).rejects.toMatchObject({
      code: 'SERVER_ERROR_500',
      message: expect.stringContaining('An unexpected error occurred.'),
    });
  });

  it('tags an unanswered request so callers can fail quietly', async () => {
    const { instance } = buildInstance([{ networkError: 'Network Error' }]);

    const error = await instance.get('/stories').catch((err) => err);

    expect(error.code).toBe('NO_RESPONSE');
    expect(isOfflineError(error)).toBe(true);
  });

  it('tags a timeout as offline too', async () => {
    const { instance } = buildInstance([{ timeout: true }]);

    const error = await instance.get('/stories').catch((err) => err);

    expect(error.code).toBe('TIMEOUT');
    expect(isOfflineError(error)).toBe(true);
  });
});

describe('token refresh on 401', () => {
  it('refreshes, retries the request and caches the new tokens', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', 'refresh-1');
    const { instance, seen } = buildInstance([
      { status: 401 },
      { status: 200, data: { ok: true } },
    ]);
    const provider = tokenProvider();
    instance.setTokenProvider(provider);

    await expect(instance.get('/stories')).resolves.toMatchObject({ data: { ok: true } });

    expect(provider.refreshAccessToken).toHaveBeenCalledWith(SERVER.id, 'refresh-1');
    expect(seen[1].headers?.Authorization).toBe('Bearer novo-access');
    expect(getServerAccessToken(SERVER.id)).toBe('novo-access');
  });

  it('gives up and clears the session when there is no refresh token', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', null);
    const { instance } = buildInstance([{ status: 401 }]);
    const provider = tokenProvider();
    instance.setTokenProvider(provider);

    await expect(instance.get('/stories')).rejects.toMatchObject({ code: 'TOKEN_REFRESH_FAILED' });

    expect(provider.clearAuth).toHaveBeenCalledWith(SERVER.id);
    expect(provider.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('clears the session when the server refuses to refresh', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', 'refresh-1');
    const { instance } = buildInstance([{ status: 401 }]);
    const provider = tokenProvider({ refreshAccessToken: jest.fn(async () => null) });
    instance.setTokenProvider(provider);

    await expect(instance.get('/stories')).rejects.toMatchObject({ code: 'TOKEN_REFRESH_FAILED' });
    expect(provider.clearAuth).toHaveBeenCalledWith(SERVER.id);
  });

  it('clears the session when the refresh call itself blows up', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', 'refresh-1');
    const { instance } = buildInstance([{ status: 401 }]);
    const provider = tokenProvider({
      refreshAccessToken: jest.fn(async () => {
        throw new Error('refresh caiu');
      }),
    });
    instance.setTokenProvider(provider);

    await expect(instance.get('/stories')).rejects.toMatchObject({ code: 'TOKEN_REFRESH_FAILED' });
    expect(provider.clearAuth).toHaveBeenCalledWith(SERVER.id);
  });

  it('refreshes once for concurrent 401s and replays both requests', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', 'refresh-1');
    const { instance } = buildInstance([
      { status: 401 },
      { status: 401 },
      { status: 200, data: { first: true } },
      { status: 200, data: { second: true } },
    ]);
    const provider = tokenProvider({
      refreshAccessToken: jest.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ accessToken: 'novo-access', refreshToken: 'novo-refresh' }),
              10,
            ),
          ),
      ),
    });
    instance.setTokenProvider(provider);

    const results = await Promise.all([instance.get('/stories'), instance.get('/characters')]);

    expect(provider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
  });

  it('does not try to refresh a failed refresh call', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', 'refresh-1');
    const { instance } = buildInstance([{ status: 401 }]);
    const provider = tokenProvider();
    instance.setTokenProvider(provider);

    await expect(instance.post('/auth/refresh', {})).rejects.toMatchObject({
      code: 'SERVER_ERROR_401',
    });
    expect(provider.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('leaves a 401 alone when no token provider is configured', async () => {
    updateServerTokenCache(SERVER.id, 'expirado', 'refresh-1');
    const { instance } = buildInstance([{ status: 401 }]);
    instance.setTokenProvider(null);

    await expect(instance.get('/stories')).rejects.toMatchObject({ code: 'SERVER_ERROR_401' });
  });

  it('does not loop forever when the retried request 401s again for a reason unrelated to the token', async () => {
    // Ex.: PUT /user/password ou /user/recovery-codes com a senha atual errada - o token é
    // válido (a renovação sempre funciona), mas o servidor recusa o conteúdo da requisição.
    // Sem a marca de "já reenviada uma vez", cada 401 dispara outra renovação, que teria vida
    // infinita: refreshAccessToken nunca falha aqui de propósito.
    updateServerTokenCache(SERVER.id, 'valido', 'refresh-1');
    const { instance } = buildInstance([
      { status: 401, data: { message: 'Current password is incorrect.' } },
      { status: 401, data: { message: 'Current password is incorrect.' } },
    ]);
    const provider = tokenProvider();
    instance.setTokenProvider(provider);

    await expect(
      instance.put('/user/recovery-codes', { currentPassword: 'wrong' }),
    ).rejects.toMatchObject({ code: 'SERVER_ERROR_401' });

    expect(provider.refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});

describe('clearAllServerAuthState', () => {
  it('forgets the tokens of every server it is given', () => {
    updateServerTokenCache('server-a', 'a', 'ra');
    updateServerTokenCache('server-b', 'b', 'rb');

    clearAllServerAuthState(['server-a', 'server-b']);

    expect(getServerAccessToken('server-a')).toBeNull();
    expect(getServerAccessToken('server-b')).toBeNull();
  });

  it('is a no-op for a server that was never used', () => {
    expect(() => clearAllServerAuthState(['nunca-visto'])).not.toThrow();
  });
});
