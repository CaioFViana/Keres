import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const smokeArgs = vi.hoisted(() => {
  const originalArgv = [...process.argv];
  process.argv.push('--sqlite-web-smoke-test');
  return { originalArgv };
});

const electronMocks = vi.hoisted(() => {
  const events = new Map<string, (...args: any[]) => unknown>();
  const windows: Array<{
    loadURL: ReturnType<typeof vi.fn>;
    webContents: {
      on: ReturnType<typeof vi.fn>;
      executeJavaScript: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
    };
  }> = [];
  const executeJavaScript = vi.fn(async () => ({ status: 'passed', checks: 3 }));
  const BrowserWindow = vi.fn(function () {
    const window = {
      loadURL: vi.fn(async () => {}),
      // `setWindowOpenHandler` faz parte do desvio de links para o navegador do sistema
      // (main.ts); sem ele no dublê, `createWindow` explode antes de carregar a página.
      webContents: { on: vi.fn(), executeJavaScript, setWindowOpenHandler: vi.fn() },
    };
    windows.push(window);
    return window;
  });

  return {
    BrowserWindow,
    clearCache: vi.fn(async () => {}),
    clearCodeCaches: vi.fn(async () => {}),
    events,
    openExternal: vi.fn(async () => {}),
    executeJavaScript,
    exit: vi.fn(),
    handle: vi.fn(),
    protocolHandle: vi.fn(),
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
    exit: electronMocks.exit,
    quit: vi.fn(),
  },
  BrowserWindow: Object.assign(electronMocks.BrowserWindow, { getAllWindows: vi.fn(() => []) }),
  ipcMain: { handle: electronMocks.handle },
  Menu: { setApplicationMenu: vi.fn() },
  shell: { openExternal: electronMocks.openExternal },
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
      clearCodeCaches: electronMocks.clearCodeCaches,
    },
  },
}));

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await import('../src/main');
  await vi.waitFor(() => expect(electronMocks.windows).toHaveLength(1));
  await vi.waitFor(() => expect(electronMocks.exit).toHaveBeenCalledWith(0));
});

afterAll(() => {
  process.argv.splice(0, process.argv.length, ...smokeArgs.originalArgv);
  vi.restoreAllMocks();
});

const listener = (windowIndex: number, event: string) => {
  const registration = electronMocks.windows[windowIndex].webContents.on.mock.calls.find(
    ([registeredEvent]) => registeredEvent === event,
  );
  return registration?.[1] as ((...args: any[]) => void) | undefined;
};

describe('SQLite web smoke mode', () => {
  it('opens a hidden window, forwards renderer diagnostics, and exits successfully', () => {
    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({ show: false }),
    );
    expect(electronMocks.windows[0].webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('keresSqliteWebSmoke'),
    );

    listener(0, 'console-message')?.({}, 2, 'sqlite ready', 12, 'app://app/entry.js');
    listener(0, 'did-fail-load')?.({}, -105, 'NAME_NOT_RESOLVED', 'app://app/');
    listener(0, 'render-process-gone')?.({}, { reason: 'crashed' });

    expect(console.log).toHaveBeenCalledWith(
      '[sqlite-web-smoke][renderer:2] app://app/entry.js:12 sqlite ready',
    );
    expect(console.error).toHaveBeenCalledWith(
      '[sqlite-web-smoke] failed to load app://app/: -105 NAME_NOT_RESOLVED',
    );
    expect(console.error).toHaveBeenCalledWith('[desktop] renderer process gone:', 'crashed');
    expect(electronMocks.exit).toHaveBeenLastCalledWith(0);
  });

  it('exits with failure when the renderer probe rejects after an app reactivation', async () => {
    electronMocks.executeJavaScript.mockRejectedValueOnce(new Error('probe failed'));

    await electronMocks.events.get('activate')?.();
    await vi.waitFor(() => expect(electronMocks.windows).toHaveLength(2));
    await vi.waitFor(() => expect(electronMocks.exit).toHaveBeenLastCalledWith(1));

    expect(console.error).toHaveBeenCalledWith('[sqlite-web-smoke] failed:', expect.any(Error));
  });
});
