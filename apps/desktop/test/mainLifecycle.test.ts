import { beforeAll, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => {
  const events = new Map<string, (...args: any[]) => unknown>();
  const windows: Array<{
    loadURL: ReturnType<typeof vi.fn>;
    webContents: { on: ReturnType<typeof vi.fn> };
  }> = [];
  const BrowserWindow = vi.fn(function () {
    const window = { loadURL: vi.fn(async () => {}), webContents: { on: vi.fn() } };
    windows.push(window);
    return window;
  });

  return {
    BrowserWindow,
    clearCache: vi.fn(async () => {}),
    clearCodeCaches: vi.fn(async () => {}),
    events,
    fetch: vi.fn(
      async () => new Response('client export', { headers: { 'content-type': 'text/html' } }),
    ),
    handle: vi.fn(),
    protocolHandle: vi.fn(),
    quit: vi.fn(),
    registerSchemesAsPrivileged: vi.fn(),
    windows,
  };
});

vi.mock('electron', () => ({
  app: {
    setName: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    isPackaged: false,
    whenReady: vi.fn(async () => {}),
    getPath: vi.fn(() => 'C:/Keres/user-data'),
    on: vi.fn((event: string, handler: (...args: any[]) => unknown) =>
      electronMocks.events.set(event, handler),
    ),
    quit: electronMocks.quit,
  },
  BrowserWindow: Object.assign(electronMocks.BrowserWindow, { getAllWindows: vi.fn(() => []) }),
  ipcMain: { handle: electronMocks.handle },
  Menu: { setApplicationMenu: vi.fn() },
  net: { fetch: electronMocks.fetch },
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
      clearCodeCaches: electronMocks.clearCodeCaches,
    },
  },
}));

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));

beforeAll(async () => {
  await import('../src/main');
  await vi.waitFor(() => expect(electronMocks.windows).toHaveLength(1));
});

describe('desktop startup', () => {
  it('registers the secure app protocol and clears stale client caches before opening the window', () => {
    expect(electronMocks.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      expect.objectContaining({
        scheme: 'app',
        privileges: expect.objectContaining({ secure: true, corsEnabled: true }),
      }),
    ]);
    expect(electronMocks.clearCache).toHaveBeenCalledOnce();
    expect(electronMocks.clearCodeCaches).toHaveBeenCalledWith({});
    expect(electronMocks.protocolHandle).toHaveBeenCalledWith('app', expect.any(Function));
    expect(electronMocks.handle).toHaveBeenCalledTimes(9);
    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Keres',
        webPreferences: expect.objectContaining({ contextIsolation: true, nodeIntegration: false }),
      }),
    );
    expect(electronMocks.windows[0].loadURL).toHaveBeenCalledWith('app://app/');
  });

  it('serves client files with isolation and no-cache headers', async () => {
    const handler = electronMocks.protocolHandle.mock.calls[0][1] as (
      request: Request,
    ) => Promise<Response>;
    const response = await handler(new Request('app://app/story'));

    expect(electronMocks.fetch).toHaveBeenCalledWith(expect.stringMatching(/^file:/));
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.text()).resolves.toBe('client export');
  });

  it('opens a new window when the app is reactivated without any open windows', async () => {
    await electronMocks.events.get('activate')?.();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledTimes(2);
  });

  it('quits when all windows close outside macOS', () => {
    electronMocks.events.get('window-all-closed')?.();

    expect(electronMocks.quit).toHaveBeenCalledOnce();
  });
});
