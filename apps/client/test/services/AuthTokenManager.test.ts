/**
 * @jest-environment node
 */
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockUserSettings = {
  activeServer: null as { id: string; url: string } | null,
  setActiveServer: jest.fn(),
  clearActiveServer: jest.fn(),
};
jest.mock('../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: { getState: () => mockUserSettings },
}));

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { authTokenManager, setAuthDb } from '../../src/services/AuthTokenManager';
import { getServerAccessToken } from '../../src/services/apiClient';
import { tokenVault } from '../../src/services/TokenVault';

const SERVER = { id: 'server-1', name: 'Casa', url: 'http://servidor' };
const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };

const secureStore = SecureStore as unknown as Record<string, jest.Mock>;

/** O que o endpoint de refresh vai responder neste teste. */
let refreshOutcome: { data?: unknown; offline?: boolean; status?: number };
let seen: string[];

function installAdapter() {
  seen = [];
  (axios.defaults as any).adapter = async (config: any) => {
    seen.push(`${config.method?.toUpperCase()} ${config.baseURL ?? ''}${config.url}`);

    if (refreshOutcome.offline) {
      const error: any = new Error('Network Error');
      error.code = 'ERR_NETWORK';
      error.config = config;
      error.request = {};
      throw error;
    }
    if (refreshOutcome.status && refreshOutcome.status >= 400) {
      const error: any = new Error(`Request failed with status code ${refreshOutcome.status}`);
      error.config = config;
      error.request = {};
      error.response = { status: refreshOutcome.status, data: {}, config, headers: {} };
      throw error;
    }
    return { data: refreshOutcome.data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

const fakeDb = (servers: unknown[] = []) =>
  ({ query: { servers: { findMany: jest.fn(async () => servers) } } }) as never;

beforeEach(async () => {
  jest.clearAllMocks();
  secureStore.getItemAsync.mockResolvedValue(null);
  secureStore.setItemAsync.mockResolvedValue(undefined);
  secureStore.deleteItemAsync.mockResolvedValue(undefined);
  await tokenVault.remove(SERVER.id);
  mockUserSettings.activeServer = null;
  refreshOutcome = { data: { accessToken: 'novo-access', refreshToken: 'novo-refresh' } };
  installAdapter();
  setAuthDb(fakeDb());
  authTokenManager.setGetServerById(jest.fn(async () => SERVER as never));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete (axios.defaults as any).adapter;
  jest.restoreAllMocks();
});

describe('updateTokens', () => {
  it('stores the new pair and publishes it to every axios instance', async () => {
    await authTokenManager.updateTokens(SERVER.id, 'access-novo', 'refresh-novo');

    expect(tokenVault.peek(SERVER.id)).toEqual({
      accessToken: 'access-novo',
      refreshToken: 'refresh-novo',
    });
    expect(getServerAccessToken(SERVER.id)).toBe('access-novo');
  });

  /**
   * O refresh que acabou de acontecer pode pertencer a uma sincronização em segundo plano de
   * um servidor que não é o aberto na tela. Escrever esses tokens no servidor errado seria bug.
   */
  it('does not touch the UI active server when the refresh was for another one', async () => {
    mockUserSettings.activeServer = { id: 'outro-servidor', url: 'http://outro' };

    await authTokenManager.updateTokens(SERVER.id, 'access-novo', 'refresh-novo');

    expect(mockUserSettings.setActiveServer).not.toHaveBeenCalled();
  });

  it('refreshes the UI active server when it is the same one', async () => {
    mockUserSettings.activeServer = { id: SERVER.id, url: SERVER.url };

    await authTokenManager.updateTokens(SERVER.id, 'access-novo', 'refresh-novo');

    expect(mockUserSettings.setActiveServer).toHaveBeenCalledTimes(1);
  });
});

describe('refreshAccessToken', () => {
  it('asks the right server for a new pair and returns it', async () => {
    await tokenVault.set(SERVER.id, TOKENS);

    const result = await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-1');

    expect(result).toEqual({ accessToken: 'novo-access', refreshToken: 'novo-refresh' });
    expect(seen).toEqual(['POST http://servidor/api/auth/refresh']);
  });

  it('stores the refreshed pair', async () => {
    await tokenVault.set(SERVER.id, TOKENS);

    await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-1');

    expect(tokenVault.peek(SERVER.id)).toEqual({
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
    });
  });

  /** O cofre é a fonte de verdade; o parâmetro é só o resgate para o interceptor. */
  it('prefers the refresh token in the vault over the one it was handed', async () => {
    await tokenVault.set(SERVER.id, { accessToken: 'a', refreshToken: 'refresh-do-cofre' });
    let body: any;
    const previous = (axios.defaults as any).adapter;
    (axios.defaults as any).adapter = async (config: any) => {
      body = JSON.parse(config.data);
      return previous(config);
    };

    await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-do-parametro');

    expect(body.refreshToken).toBe('refresh-do-cofre');
  });

  it('falls back to the handed token when the vault is empty', async () => {
    let body: any;
    const previous = (axios.defaults as any).adapter;
    (axios.defaults as any).adapter = async (config: any) => {
      body = JSON.parse(config.data);
      return previous(config);
    };

    await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-do-parametro');

    expect(body.refreshToken).toBe('refresh-do-parametro');
  });

  /**
   * O ponto mais importante deste serviço: servidor fora do ar não diz nada sobre a validade
   * da credencial. Limpar aqui deslogaria uma conta perfeitamente boa por causa de uma
   * oscilação de rede.
   */
  it('keeps the credentials when the server is unreachable', async () => {
    await tokenVault.set(SERVER.id, TOKENS);
    refreshOutcome = { offline: true };

    const result = await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-1');

    expect(result).toBeNull();
    expect(tokenVault.peek(SERVER.id)).toEqual(TOKENS);
  });

  it('clears the credentials when the server actually rejects them', async () => {
    await tokenVault.set(SERVER.id, TOKENS);
    refreshOutcome = { status: 401 };

    const result = await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-1');

    expect(result).toBeNull();
    expect(tokenVault.peek(SERVER.id)).toBeNull();
  });

  it('gives up when there is no refresh token anywhere', async () => {
    const result = await authTokenManager.refreshAccessToken(SERVER.id, '');

    expect(result).toBeNull();
    expect(seen).toEqual([]);
  });

  it('gives up when the server is not registered locally', async () => {
    authTokenManager.setGetServerById(jest.fn(async () => undefined as never));
    await tokenVault.set(SERVER.id, TOKENS);

    const result = await authTokenManager.refreshAccessToken(SERVER.id, 'refresh-1');

    expect(result).toBeNull();
    expect(seen).toEqual([]);
  });

  it('gives up when there is no database yet', async () => {
    setAuthDb(null);

    await expect(authTokenManager.refreshAccessToken(SERVER.id, 'refresh-1')).resolves.toBeNull();
  });
});

describe('hydrateTokens', () => {
  it('loads the stored credentials of every registered server into the request cache', async () => {
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify(TOKENS));
    setAuthDb(fakeDb([{ id: SERVER.id }]));

    await authTokenManager.hydrateTokens();

    expect(getServerAccessToken(SERVER.id)).toBe('access-1');
  });

  it('skips a server with nothing stored', async () => {
    secureStore.getItemAsync.mockResolvedValue(null);
    setAuthDb(fakeDb([{ id: 'sem-token' }]));

    await authTokenManager.hydrateTokens();

    expect(getServerAccessToken('sem-token')).toBeNull();
  });

  it('does nothing when there is no database yet', async () => {
    setAuthDb(null);

    await expect(authTokenManager.hydrateTokens()).resolves.toBeUndefined();
  });
});

describe('clearAuthForServer', () => {
  it('forgets the credentials in both the vault and the request cache', async () => {
    await authTokenManager.updateTokens(SERVER.id, 'access-1', 'refresh-1');

    await authTokenManager.clearAuthForServer(SERVER.id);

    expect(tokenVault.peek(SERVER.id)).toBeNull();
    expect(getServerAccessToken(SERVER.id)).toBeNull();
  });

  it('signs the UI out when the server was the active one', async () => {
    mockUserSettings.activeServer = { id: SERVER.id, url: SERVER.url };

    await authTokenManager.clearAuthForServer(SERVER.id);

    expect(mockUserSettings.clearActiveServer).toHaveBeenCalledTimes(1);
  });

  it('leaves the UI alone when another server was active', async () => {
    mockUserSettings.activeServer = { id: 'outro-servidor', url: 'http://outro' };

    await authTokenManager.clearAuthForServer(SERVER.id);

    expect(mockUserSettings.clearActiveServer).not.toHaveBeenCalled();
  });

  it('survives a vault that fails to delete', async () => {
    secureStore.deleteItemAsync.mockRejectedValueOnce(new Error('cofre indisponível'));

    await expect(authTokenManager.clearAuthForServer(SERVER.id)).resolves.toBeUndefined();
  });
});

describe('clearAllAuth', () => {
  it('wipes every server it was given', async () => {
    await authTokenManager.updateTokens('server-a', 'a', 'ra');
    await authTokenManager.updateTokens('server-b', 'b', 'rb');

    await authTokenManager.clearAllAuth(['server-a', 'server-b']);

    expect(getServerAccessToken('server-a')).toBeNull();
    expect(getServerAccessToken('server-b')).toBeNull();
    expect(mockUserSettings.clearActiveServer).toHaveBeenCalled();
  });
});
