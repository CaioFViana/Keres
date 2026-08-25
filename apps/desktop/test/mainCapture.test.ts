import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const captureEnvironment = vi.hoisted(() => {
  const originalArgv = [...process.argv];
  const originalDebug = process.env.KERES_CAPTURE_DEBUG;
  process.argv.push('--capture-screens=C:/plans/showcase.json');
  process.env.KERES_CAPTURE_DEBUG = '1';
  return { originalArgv, originalDebug };
});

const fileMocks = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(
    async () =>
      JSON.stringify({
        outputDirectory: 'C:/captures',
        shots: [
          {
            name: 'characters',
            query: 'showcase=characters',
            width: 1440,
            height: 900,
            settleMs: 10,
            press: 'Fit to screen',
            pressWaitMs: 5,
          },
        ],
      }),
  ),
  writeFile: vi.fn(async () => undefined),
}));

function paintedImage(painted = true) {
  const bitmap = Buffer.alloc(4 * 80);
  if (painted) bitmap.writeUInt32LE(1, 4);
  return {
    captureValue: painted,
    crop: vi.fn(() => ({ toBitmap: vi.fn(() => bitmap) })),
    getSize: vi.fn(() => ({ width: 1440, height: 900 })),
    isEmpty: vi.fn(() => false),
    toPNG: vi.fn(() => Buffer.from('png')),
  };
}

const electronMocks = vi.hoisted(() => {
  const events = new Map<string, (...args: any[]) => unknown>();
  const windows: any[] = [];
  const image = paintedImage();
  const BrowserWindow = vi.fn(function () {
    const webContents = {
      capturePage: vi.fn(async () => image),
      executeJavaScript: vi.fn(async (script: string) => {
        if (script.includes('document.querySelector')) return { x: 120, y: 80 };
        if (script.includes('innerText') && !script.includes('keresShowcase')) return 'rendered';
        return true;
      }),
      on: vi.fn(),
      sendInputEvent: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    };
    const window = {
      loadURL: vi.fn(async () => undefined),
      setContentSize: vi.fn(),
      showInactive: vi.fn(),
      webContents,
    };
    windows.push(window);
    return window;
  });

  return {
    BrowserWindow,
    events,
    exit: vi.fn(),
    handle: vi.fn(),
    image,
    windows,
  };
});

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));
vi.mock('fs/promises', () => fileMocks);
vi.mock('electron', () => ({
  app: {
    setName: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    isPackaged: false,
    whenReady: vi.fn(async () => undefined),
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
  net: { fetch: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  safeStorage: {
    isAsyncEncryptionAvailable: vi.fn(async () => true),
    getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
    encryptStringAsync: vi.fn(),
    decryptStringAsync: vi.fn(),
  },
  session: {
    defaultSession: { clearCache: vi.fn(async () => undefined), clearCodeCaches: vi.fn() },
  },
  shell: { openExternal: vi.fn() },
}));

let main: typeof import('../src/main');

beforeAll(async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  main = await import('../src/main');
  await vi.runAllTimersAsync();
  await vi.waitFor(() => expect(electronMocks.exit).toHaveBeenCalledWith(0));
});

afterAll(() => {
  process.argv.splice(0, process.argv.length, ...captureEnvironment.originalArgv);
  if (captureEnvironment.originalDebug === undefined) delete process.env.KERES_CAPTURE_DEBUG;
  else process.env.KERES_CAPTURE_DEBUG = captureEnvironment.originalDebug;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('screen capture lifecycle', () => {
  it('loads the plan, activates the hidden window, presses the control and writes the PNG', () => {
    const win = electronMocks.windows[0];

    expect(win.showInactive).toHaveBeenCalledOnce();
    expect(win.setContentSize).toHaveBeenCalledWith(1440, 900);
    expect(win.loadURL).toHaveBeenCalledWith('app://app/?showcase=characters');
    expect(win.webContents.sendInputEvent).toHaveBeenCalledTimes(2);
    expect(fileMocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/captures[\\/]characters\.png$/),
      Buffer.from('png'),
    );
  });

  it('forwards renderer diagnostics while capture debugging is active', () => {
    const registrations = electronMocks.windows[0].webContents.on.mock.calls;
    const consoleListener = registrations.find(([event]: any[]) => event === 'console-message')?.[1];
    const goneListener = [...registrations].reverse().find(
      ([event]: any[]) => event === 'render-process-gone',
    )?.[1];

    consoleListener({ message: 'renderer ready' });
    goneListener({}, { reason: 'crashed' });

    expect(console.log).toHaveBeenCalledWith('[renderer]', 'renderer ready');
    expect(console.log).toHaveBeenCalledWith('[renderer] morreu:', '{"reason":"crashed"}');
  });
});

describe('capture safeguards', () => {
  it('continues without clicking when the requested control is absent', async () => {
    const win = electronMocks.windows[0];
    win.webContents.sendInputEvent.mockClear();
    win.webContents.executeJavaScript.mockResolvedValueOnce(null);

    await main.pressControl(win, 'Missing control', 10);

    expect(win.webContents.sendInputEvent).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[capture] controle "Missing control" não encontrado; seguindo sem acionar.',
    );
  });

  it('recognizes both painted and uniform frames', () => {
    expect(main.isFullyPainted(paintedImage(true) as any)).toBe(true);
    expect(main.isFullyPainted(paintedImage(false) as any)).toBe(false);
  });

  it('retries empty, partially painted and failed frames before returning a complete one', async () => {
    const complete = paintedImage(true);
    const partial = paintedImage(false);
    const empty = { ...paintedImage(true), isEmpty: vi.fn(() => true) };
    const win = {
      webContents: {
        executeJavaScript: vi.fn(async () => true),
        capturePage: vi
          .fn()
          .mockRejectedValueOnce(new Error('compositor busy'))
          .mockResolvedValueOnce(empty)
          .mockResolvedValueOnce(partial)
          .mockResolvedValueOnce(complete),
      },
    };

    const pending = main.capturePageWithRetry(win as any);
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBe(complete);
    expect(win.webContents.capturePage).toHaveBeenCalledTimes(4);
  });

  it('throws the last capture error after exhausting all retries', async () => {
    const error = new Error('capture unavailable');
    const win = {
      webContents: {
        executeJavaScript: vi.fn(async () => true),
        capturePage: vi.fn(async () => {
          throw error;
        }),
      },
    };

    const pending = main.capturePageWithRetry(win as any);
    const assertion = expect(pending).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('exits with failure when a capture plan cannot be read', async () => {
    fileMocks.readFile.mockRejectedValueOnce(new Error('invalid plan'));

    await main.captureScreens(electronMocks.windows[0], 'C:/plans/invalid.json');

    expect(console.error).toHaveBeenCalledWith('[capture] falhou:', expect.any(Error));
    expect(electronMocks.exit).toHaveBeenCalledWith(1);
  });
});
