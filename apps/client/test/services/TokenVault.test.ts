/**
 * @jest-environment node
 */
// `__esModule` matters: the vault uses `import * as SecureStore`, and without this mark Babel's
// interop hands the whole mock over as `default`, leaving the namespace without a single function.
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { tokenVault } from '../../src/services/TokenVault';

const mockSecureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const OTHER = { accessToken: 'access-2', refreshToken: 'refresh-2' };

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

const originalOS = Platform.OS;

/** Ponte que o Electron injeta em `window.keresAuth` no caminho web. */
const electronBridge = (available = true) => ({
  status: jest.fn(async () => ({ available })),
  read: jest.fn(async () => null as typeof TOKENS | null),
  write: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockSecureStore.getItemAsync.mockResolvedValue(null);
  mockSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
  setPlatform('ios');
  // The vault keeps an in-memory cache; clearing the servers used isolates each test.
  for (const serverId of ['server-1', 'server-2']) {
    await tokenVault.remove(serverId);
  }
  jest.clearAllMocks();
  (globalThis as any).window = undefined;
});

afterEach(() => {
  setPlatform(originalOS);
  delete (globalThis as any).window;
});

/**
 * The credentials deliberately stay outside SQLite/OPFS: on native they go to the SecureStore, and
 * on the desktop to the system vault through the Electron bridge. The in-memory cache exists so the
 * synchronization's hot path does not pay a vault read on every request.
 */
describe('on native', () => {
  it('reads from the secure store the first time', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(TOKENS));

    expect(await tokenVault.get('server-1')).toEqual(TOKENS);
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('keres.auth.server-1');
  });

  it('serves later reads from memory, without touching the secure store again', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(TOKENS));
    await tokenVault.get('server-1');
    mockSecureStore.getItemAsync.mockClear();

    expect(await tokenVault.get('server-1')).toEqual(TOKENS);
    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('returns null for a server with nothing stored', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

    expect(await tokenVault.get('server-1')).toBeNull();
  });

  it('writes the tokens as JSON under the server key', async () => {
    await tokenVault.set('server-1', TOKENS);

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'keres.auth.server-1',
      JSON.stringify(TOKENS),
    );
  });

  it('makes a written token readable straight from memory', async () => {
    await tokenVault.set('server-1', TOKENS);

    expect(tokenVault.peek('server-1')).toEqual(TOKENS);
    expect(await tokenVault.get('server-1')).toEqual(TOKENS);
    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('overwrites the previous tokens of the same server', async () => {
    await tokenVault.set('server-1', TOKENS);

    await tokenVault.set('server-1', OTHER);

    expect(tokenVault.peek('server-1')).toEqual(OTHER);
  });

  it('clears both the secure store and the memory on remove', async () => {
    await tokenVault.set('server-1', TOKENS);

    await tokenVault.remove('server-1');

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('keres.auth.server-1');
    expect(tokenVault.peek('server-1')).toBeNull();
  });

  it('keeps servers apart, so signing out of one keeps the other', async () => {
    await tokenVault.set('server-1', TOKENS);
    await tokenVault.set('server-2', OTHER);

    await tokenVault.remove('server-1');

    expect(tokenVault.peek('server-1')).toBeNull();
    expect(tokenVault.peek('server-2')).toEqual(OTHER);
  });
});

describe('peek', () => {
  it('never hits storage, so a caller on the hot path cannot block on it', async () => {
    expect(tokenVault.peek('server-1')).toBeNull();
    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
  });
});

describe('on web, through the Electron bridge', () => {
  it('reads through the bridge', async () => {
    const bridge = electronBridge();
    bridge.read.mockResolvedValueOnce(TOKENS);
    (globalThis as any).window = { keresAuth: bridge };
    setPlatform('web');

    expect(await tokenVault.get('server-1')).toEqual(TOKENS);
    expect(bridge.read).toHaveBeenCalledWith('server-1');
    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('writes through the bridge when secure storage is available', async () => {
    const bridge = electronBridge(true);
    (globalThis as any).window = { keresAuth: bridge };
    setPlatform('web');

    await tokenVault.set('server-1', TOKENS);

    expect(bridge.write).toHaveBeenCalledWith('server-1', TOKENS);
  });

  /** Without a system vault, the token lives only in memory - it is never written in the clear. */
  it('does not write when the platform has no secure storage', async () => {
    const bridge = electronBridge(false);
    (globalThis as any).window = { keresAuth: bridge };
    setPlatform('web');

    await tokenVault.set('server-1', TOKENS);

    expect(bridge.write).not.toHaveBeenCalled();
    expect(tokenVault.peek('server-1')).toEqual(TOKENS);
  });

  it('still works in a plain browser, with no bridge at all', async () => {
    (globalThis as any).window = {};
    setPlatform('web');

    await expect(tokenVault.get('server-1')).resolves.toBeNull();
    await expect(tokenVault.set('server-1', TOKENS)).resolves.toBeUndefined();
    expect(tokenVault.peek('server-1')).toEqual(TOKENS);
  });

  it('removes through the bridge', async () => {
    const bridge = electronBridge();
    (globalThis as any).window = { keresAuth: bridge };
    setPlatform('web');
    await tokenVault.set('server-1', TOKENS);

    await tokenVault.remove('server-1');

    expect(bridge.remove).toHaveBeenCalledWith('server-1');
    expect(tokenVault.peek('server-1')).toBeNull();
  });
});
