import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const originalPlatform = process.platform;
Object.defineProperty(process, 'platform', { value: 'darwin' });

const electronMocks = vi.hoisted(() => {
  const events = new Map<string, (...args: any[]) => unknown>();
  const windows: Array<{ loadURL: ReturnType<typeof vi.fn> }> = [];
  const BrowserWindow = vi.fn(function () {
    const window = {
      loadURL: vi.fn(async () => {}),
      webContents: { on: vi.fn(), setWindowOpenHandler: vi.fn() },
    };
    windows.push(window);
    return window;
  });

  return {
    BrowserWindow,
    clearCache: vi.fn(async () => {}),
    clearCodeCaches: vi.fn(async () => {}),
    events,
    protocolHandle: vi.fn(),
    setIcon: vi.fn(),
    windows,
  };
});

vi.mock('electron', () => ({
  app: {
    setName: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    commandLine: { appendSwitch: vi.fn() },
    dock: { setIcon: electronMocks.setIcon },
    isPackaged: false,
    whenReady: vi.fn(async () => {}),
    getPath: vi.fn(() => 'C:/Keres/user-data'),
    on: vi.fn((event: string, handler: (...args: any[]) => unknown) =>
      electronMocks.events.set(event, handler),
    ),
    quit: vi.fn(),
    exit: vi.fn(),
  },
  BrowserWindow: Object.assign(electronMocks.BrowserWindow, { getAllWindows: vi.fn(() => []) }),
  ipcMain: { handle: vi.fn() },
  Menu: { setApplicationMenu: vi.fn() },
  shell: { openExternal: vi.fn() },
  net: { fetch: vi.fn() },
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
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
      clearCodeCaches: electronMocks.clearCodeCaches,
    },
  },
}));

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));

beforeAll(async () => {
  await import('../src/main');
  await vi.waitFor(() => expect(electronMocks.windows).toHaveLength(1));
});

afterAll(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
});

describe('macOS dock icon', () => {
  it('sets the dock icon instead of showing the generic Electron one', () => {
    expect(electronMocks.setIcon).toHaveBeenCalledWith(
      expect.stringContaining('desktop_icon.png'),
    );
  });
});
