import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The instance that did not get the lock: another one already has this profile, so this one must leave
 * without opening a window, serving the client, registering the channels that touch the vault and the
 * media, or listening for yet another launch.
 */
const electronMocks = vi.hoisted(() => {
  const events = new Map<string, (...args: any[]) => unknown>();
  return {
    BrowserWindow: vi.fn(),
    clearCache: vi.fn(async () => {}),
    events,
    handle: vi.fn(),
    protocolHandle: vi.fn(),
    quit: vi.fn(),
    registerSchemesAsPrivileged: vi.fn(),
    ready: vi.fn(async () => {}),
  };
});

vi.mock('electron', () => ({
  app: {
    setName: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => false),
    commandLine: { appendSwitch: vi.fn() },
    isPackaged: false,
    whenReady: electronMocks.ready,
    getPath: vi.fn(() => 'C:/Keres/user-data'),
    on: vi.fn((event: string, handler: (...args: any[]) => unknown) =>
      electronMocks.events.set(event, handler),
    ),
    quit: electronMocks.quit,
  },
  BrowserWindow: Object.assign(electronMocks.BrowserWindow, { getAllWindows: vi.fn(() => []) }),
  ipcMain: { handle: electronMocks.handle },
  Menu: { setApplicationMenu: vi.fn() },
  shell: { openExternal: vi.fn() },
  net: { fetch: vi.fn() },
  protocol: {
    registerSchemesAsPrivileged: electronMocks.registerSchemesAsPrivileged,
    handle: electronMocks.protocolHandle,
  },
  safeStorage: {
    isAsyncEncryptionAvailable: vi.fn(async () => true),
    getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
    encryptStringAsync: vi.fn(),
    decryptStringAsync: vi.fn(),
  },
  session: {
    defaultSession: {
      clearCache: electronMocks.clearCache,
      clearCodeCaches: vi.fn(async () => {}),
    },
  },
}));

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));

let main: typeof import('../src/main');

beforeAll(async () => {
  main = await import('../src/main');
  // `whenReady`'s callback runs on the microtask after it: give it its turn.
  await new Promise((resolve) => setTimeout(resolve, 20));
});

describe('a second instance', () => {
  it('knows it did not get the lock, and quits', () => {
    expect(main.hasInstanceLock).toBe(false);
    expect(electronMocks.quit).toHaveBeenCalledOnce();
  });

  it('opens no window and clears nothing in the profile of the one that is running', () => {
    expect(electronMocks.BrowserWindow).not.toHaveBeenCalled();
    expect(electronMocks.clearCache).not.toHaveBeenCalled();
    expect(electronMocks.protocolHandle).not.toHaveBeenCalled();
  });

  it('registers none of the channels that reach the vault and the media', () => {
    expect(electronMocks.handle).not.toHaveBeenCalled();
  });

  it('does not listen for yet another launch', () => {
    expect(electronMocks.events.has('second-instance')).toBe(false);
  });
});
