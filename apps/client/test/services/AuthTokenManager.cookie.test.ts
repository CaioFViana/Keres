/**
 * @jest-environment node
 */
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: { getState: () => mockUserSettings },
}));
jest.mock('../../src/services/browserCookieSession', () => ({
  usesHttpOnlyCookieSession: jest.fn(),
  canRefreshSessionWithCookie: jest.fn(),
}));

import axios from 'axios';
import { authTokenManager, setAuthDb } from '../../src/services/AuthTokenManager';
import {
  canRefreshSessionWithCookie,
  usesHttpOnlyCookieSession,
} from '../../src/services/browserCookieSession';
import { tokenVault } from '../../src/services/TokenVault';

const mockUserSettings = {
  activeServer: null as { id: string; url: string } | null,
  setActiveServer: jest.fn(),
  clearActiveServer: jest.fn(),
};

/**
 * The hosted-web logout: clearing auth also tells the server to drop the HttpOnly cookie.
 *
 * On a co-hosted web build the session lives in a cookie the client cannot even read, so
 * `clearAuthForServer` POSTs `/auth/logout` before wiping the local vault. A logout that fails
 * (the tab is already offline, say) must not keep the local credentials around: the cookie is
 * useless without the server, the vault entries are useless without the cookie, and the user
 * asked to leave.
 */

const SERVER = { id: 'server-1', name: 'Casa', url: 'http://localhost:3000' };
const usesCookie = usesHttpOnlyCookieSession as jest.Mock;
const canRefreshWithCookie = canRefreshSessionWithCookie as jest.Mock;

let seen: string[];

beforeEach(async () => {
  jest.clearAllMocks();
  mockUserSettings.activeServer = null;
  usesCookie.mockReturnValue(true);
  canRefreshWithCookie.mockReturnValue(true);
  seen = [];
  (axios.defaults as { adapter?: unknown }).adapter = async (config: {
    method?: string;
    baseURL?: string;
    url?: string;
  }) => {
    seen.push(`${config.method?.toUpperCase()} ${config.baseURL ?? ''}${config.url}`);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await tokenVault.set(SERVER.id, { accessToken: 'a', refreshToken: 'r' });
  setAuthDb({} as never);
  authTokenManager.setGetServerById(jest.fn(async () => SERVER as never));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete (axios.defaults as { adapter?: unknown }).adapter;
  jest.restoreAllMocks();
});

describe('AuthTokenManager cookie logout', () => {
  it('tells the server to drop the cookie before wiping the vault', async () => {
    await authTokenManager.clearAuthForServer(SERVER.id);

    expect(seen).toEqual(['POST http://localhost:3000/api/auth/logout']);
    expect(tokenVault.peek(SERVER.id)).toBeNull();
  });

  it('still wipes the vault when the logout call fails', async () => {
    (axios.defaults as { adapter?: unknown }).adapter = async () => {
      throw new Error('offline');
    };

    await authTokenManager.clearAuthForServer(SERVER.id);

    expect(console.log).toHaveBeenCalledWith('Failed to clear session cookie:', expect.any(Error));
    expect(tokenVault.peek(SERVER.id)).toBeNull();
  });

  it('skips the logout call when the server cannot take a cookie session', async () => {
    canRefreshWithCookie.mockReturnValue(false);

    await authTokenManager.clearAuthForServer(SERVER.id);

    expect(seen).toEqual([]);
    expect(tokenVault.peek(SERVER.id)).toBeNull();
  });
});
