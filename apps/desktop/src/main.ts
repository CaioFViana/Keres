import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  session,
  shell,
} from 'electron';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { resolveClientFile, resolveMediaPath as resolveMediaPathIn } from './paths';
import {
  assertValidServerId,
  isExternalBrowserUrl,
  isInAppNavigation,
  isTrustedRendererUrl,
} from './security';

// package.json's "name" is "@keres/desktop" (the workspace naming convention, "@keres/*"
// everywhere) - Electron otherwise derives the userData path directly from it, and the "/"
// splits it into two real directories on disk. That confused Chromium's OPFS/File System
// Access storage backend badly enough to corrupt its lock file (SandboxOriginDatabase
// "Access denied" on .../File System/Origins/LOCK). Must be set before app.whenReady().
app.setName('Keres');

// AppImages don't have Flatpak's Secret portal. Prefer the cross-desktop Secret
// Service there instead of Chromium silently selecting its plaintext backend.
app.commandLine.appendSwitch('password-store', 'gnome-libsecret');

/**
 * apps/client's data layer (drizzle-orm/expo-sqlite) uses expo-sqlite's *sync* driver
 * exclusively. On web, expo-sqlite backs that with wa-sqlite (WASM) + OPFS running in a
 * Worker, bridged to the main thread via `new SharedArrayBuffer()` + Atomics (see
 * node_modules/expo-sqlite/web/WorkerChannel.ts). Browsers only allow SharedArrayBuffer on
 * a crossOriginIsolated page, i.e. served with COOP/COEP response headers - something a
 * plain static file host (or opening the export via file://) does not provide. That is the
 * only reason this needs a host like Electron: apps/client's web export otherwise runs
 * completely unmodified, SQLite driver included.
 */
// Dev: apps/desktop/dist-electron/main.js -> ../../client/dist.
// Packaged: electron-builder's extraResources puts it at resourcesPath/client-dist
// (see electron-builder.yml) since the source tree isn't shipped in the installer.
const CLIENT_DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'client-dist')
  : path.join(__dirname, '..', '..', 'client', 'dist');

// Same reasoning as CLIENT_DIST above. This is only for the *runtime* window/dock icon
// (dev mode and title bar) - the packaged .exe/.app icon itself is handled separately by
// electron-builder.yml's win/mac/linux.icon, which converts this same source PNG to
// .ico/.icns automatically at package time.
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'desktop_icon.png')
  : path.join(__dirname, '..', '..', 'client', 'assets', 'images', 'desktop_icon.png');

const SCHEME = 'app';

const APP_NAME = 'Keres';
const SQLITE_WEB_SMOKE_TEST = process.argv.includes('--sqlite-web-smoke-test');

/**
 * Screen capture for the website's showcase.
 *
 * Electron is already the host the web app needs (the `app://` protocol with COOP/COEP, see
 * `withIsolationHeaders`), so capturing here needs no automation browser: it is the same runtime
 * the desktop app ships to users, photographing itself.
 *
 * `--capture-screens=<file.json>` receives the list of images to take; each item becomes an
 * `app://app/?showcase=...` URL that the app's showcase mode understands (see `showcaseRequest.ts`).
 */
const CAPTURE_ARGUMENT = process.argv.find((argument) => argument.startsWith('--capture-screens='));
const CAPTURE_PLAN_PATH = CAPTURE_ARGUMENT?.split('=').slice(1).join('=');
const HEADLESS = SQLITE_WEB_SMOKE_TEST || !!CAPTURE_PLAN_PATH;

interface CaptureShot {
  name: string;
  query: string;
  width: number;
  height: number;
  /** Extra wait after loading, for graphs that draw themselves in two passes. */
  settleMs?: number;
  /**
   * Accessibility label of a control to press before the photo - the graphs open in the top-left
   * corner and only fit whole after "fit to screen".
   */
  press?: string;
  /** Wait after the click, for animations longer than the default. */
  pressWaitMs?: number;
}

interface CapturePlan {
  outputDirectory: string;
  shots: CaptureShot[];
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function withIsolationHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  // Every rebuild of apps/client changes CLIENT_DIST's contents on disk under the same
  // app:// URLs (only the hashed JS filenames referenced *from* index.html change - index.html
  // itself doesn't). Without this, Chromium's HTTP cache can keep serving a stale index.html
  // (and whatever entry-<hash>.js it references) across reloads, silently hiding new builds.
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleAppRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const relativePath = decodeURIComponent(url.pathname);
  const filePath = resolveClientFile(
    CLIENT_DIST,
    relativePath === '/' ? '/index.html' : relativePath,
    existsSync,
  );
  const response = await net.fetch(pathToFileURL(filePath).toString());
  return withIsolationHeaders(response);
}

async function createWindow() {
  if (!existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    throw new Error(
      `Client web export not found at ${CLIENT_DIST}. Run 'bun run client:build' first.`,
    );
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: APP_NAME,
    show: !HEADLESS,
    icon: APP_ICON, // Windows/Linux taskbar + title bar. No-op on macOS - see app.dock.setIcon below.
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[desktop] renderer process gone:', details.reason);
  });

  // An outbound link (a story's public address, the documentation, a server) goes to the system
  // browser, not inside this window: the app has no address bar, no back button and none of the
  // sessions the person already has in their browser.
  //
  // Both paths need covering, because React Native Web's `Linking.openURL` can become either a
  // `window.open` or a navigation of the page itself, depending on platform and target:
  //   - setWindowOpenHandler: `window.open` / `target="_blank"`
  //   - will-navigate: `location.href = ...` / clicking an ordinary link
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalBrowserUrl(url)) {
      void shell.openExternal(url);
    }
    // Always `deny`: not even a rejected scheme should open a new Electron window.
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isInAppNavigation(url)) {
      return;
    }
    event.preventDefault();
    if (isExternalBrowserUrl(url)) {
      void shell.openExternal(url);
    }
  });
  if (SQLITE_WEB_SMOKE_TEST) {
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[sqlite-web-smoke][renderer:${level}] ${sourceId}:${line} ${message}`);
    });
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[sqlite-web-smoke] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`,
      );
    });
  }

  // apps/client's DocumentTitleSync now keeps document.title in sync with whatever screen is
  // focused ("Keres: Character - Aragorn", "Keres: Story Settings", ...). Electron's default
  // behavior - mirroring the window title to page-title-updated - is exactly what's wanted
  // here, so nothing needs to be done beyond the `title` option above, which only covers the
  // brief window before that first render.
  if (process.env.KERES_CAPTURE_DEBUG) attachRendererLog(win);

  if (CAPTURE_PLAN_PATH) {
    // The window has to be visible: hidden it composes no frames and `capturePage()` returns a blank
    // image; moved off-screen, the Windows compositor refuses the capture (`UnknownVizError`).
    // `showInactive` at least does not steal focus from whoever is running the script.
    win.showInactive();
    await captureScreens(win, CAPTURE_PLAN_PATH);
    return;
  }

  await win.loadURL(`${SCHEME}://app/`);

  if (SQLITE_WEB_SMOKE_TEST) {
    try {
      const result = await win.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          const deadline = Date.now() + 30000;
          const poll = () => {
            const serialized = document.documentElement.dataset.keresSqliteWebSmoke;
            const result = serialized ? JSON.parse(serialized) : undefined;
            if (result?.status === 'passed') return resolve(result);
            if (result?.status === 'failed') return reject(new Error(result.message));
            if (Date.now() >= deadline) return reject(new Error('Timed out waiting for the SQLite web smoke probe.'));
            setTimeout(poll, 50);
          };
          poll();
        });
      `);
      console.log('[sqlite-web-smoke] passed:', result);
      app.exit(0);
    } catch (error) {
      console.error('[sqlite-web-smoke] failed:', error);
      app.exit(1);
    }
  }
}

/**
 * One image per plan item: resize the window, open the showcase URL, wait for the screen to
 * settle and write the PNG.
 *
 * Each photo reloads the page from scratch instead of navigating inside the app: it is slower and
 * it is deliberate - that way a screen never shows a remnant of the previous one (an open drawer,
 * a scroll halfway down, a modal closing).
 */
export async function captureScreens(win: BrowserWindow, planPath: string): Promise<void> {
  try {
    const plan: CapturePlan = JSON.parse(await fs.readFile(planPath, 'utf8'));
    await fs.mkdir(plan.outputDirectory, { recursive: true });

    for (const shot of plan.shots) {
      win.setContentSize(shot.width, shot.height);
      // A moment for the compositor to catch up with the new size before loading the page.
      await new Promise((resolve) => setTimeout(resolve, 250));
      await win.loadURL(`${SCHEME}://app/?${shot.query}`);
      await waitForShowcase(win);
      // Settling: the data is ready, but the screen is still mounting and the graphs draw themselves in
      // two passes (measure, then draw).
      await new Promise((resolve) => setTimeout(resolve, shot.settleMs ?? 1800));
      if (shot.press) await pressControl(win, shot.press, shot.pressWaitMs ?? 900);
      const image = await capturePageWithRetry(win);
      if (process.env.KERES_CAPTURE_DEBUG) {
        const texto = await win.webContents.executeJavaScript(
          '(document.body?.innerText ?? "").slice(0, 200)',
        );
        console.log(`[capture][debug] ${shot.name}: ${JSON.stringify(texto)}`);
      }
      const target = path.join(plan.outputDirectory, `${shot.name}.png`);
      await fs.writeFile(target, image.toPNG());
      console.log(`[capture] ${shot.name}.png  ${shot.width}x${shot.height}`);
    }
    app.exit(0);
  } catch (error) {
    console.error('[capture] falhou:', error);
    app.exit(1);
  }
}

/**
 * Mirrors the renderer's console into the terminal, with `KERES_CAPTURE_DEBUG=1`.
 *
 * The capture window has no DevTools within reach, and a screen that fails to come up disappears
 * silently - that is how the `initialRouteName` pointing at a nonexistent route showed up.
 */
export function attachRendererLog(win: BrowserWindow): void {
  win.webContents.on('console-message', (event) => console.log('[renderer]', event.message));
  win.webContents.on('render-process-gone', (_event, details) =>
    console.log('[renderer] morreu:', JSON.stringify(details)),
  );
}

/**
 * Presses a control on the screen by its accessibility label.
 *
 * It uses `sendInputEvent`, which delivers a **trusted** click to the renderer - React Native Web
 * ignores synthetic events dispatched from inside the page, so it is this or nothing. It is also
 * the only point of the capture that simulates a person using the app.
 */
export async function pressControl(
  win: BrowserWindow,
  label: string,
  waitMs: number,
): Promise<void> {
  const point = await win.webContents.executeJavaScript(`
    (() => {
      const rotulo = ${JSON.stringify(label)};
      // Accessibility label first; then visible text, which is how a list item (a character, a scene)
      // is found without inventing identifiers just for the photo.
      const alvo =
        document.querySelector('[aria-label="' + rotulo + '"]') ??
        Array.from(document.querySelectorAll('div,span,a,button')).find(
          (no) => no.textContent?.trim() === rotulo && no.getBoundingClientRect().height > 0,
        );
      if (!alvo) return null;
      const r = alvo.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()
  `);
  if (!point) {
    console.warn(`[capture] controle "${label}" não encontrado; seguindo sem acionar.`);
    return;
  }
  win.webContents.sendInputEvent({
    type: 'mouseDown',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  win.webContents.sendInputEvent({
    type: 'mouseUp',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/**
 * The Windows compositor refuses the capture every now and then right after the window changes
 * size or content (`UnknownVizError`), and the error is transient: trying again a moment later
 * works. Without this, a whole run dies because of a single photo.
 */
export async function capturePageWithRetry(win: BrowserWindow): Promise<Electron.NativeImage> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await waitForFrame(win);
      const image = await win.webContents.capturePage();
      if (image.isEmpty()) {
        lastError = new Error('imagem vazia');
      } else if (!isFullyPainted(image)) {
        // It happens that the compositor hands over a frame with layers not yet rasterised: the photo
        // comes out with the side drawer black, or with the graph's lines missing their labels. None of
        // that is an "empty" image, so only by looking at the content can it be refused.
        lastError = new Error('quadro pintado pela metade');
      } else {
        return image;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw lastError;
}

/** Espera o renderizador entregar um quadro; dois `requestAnimationFrame` bastam. */
async function waitForFrame(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(
    'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))',
  );
}

/**
 * The left band is the app's drawer: a written menu, the selected item highlighted, a border.
 * When it comes out as a rectangle of a single colour, the frame arrived before the painting -
 * and it is the same frame in which the graph's labels are missing next to it.
 */
export function isFullyPainted(image: Electron.NativeImage): boolean {
  const { width, height } = image.getSize();
  const drawer = image.crop({ x: 0, y: 0, width: Math.min(240, width), height });
  const pixels = drawer.toBitmap();
  const first = pixels.readUInt32LE(0);
  for (let offset = 4; offset + 4 <= pixels.length; offset += 4 * 37) {
    if (pixels.readUInt32LE(offset) !== first) return true;
  }
  return false;
}

/**
 * Waits for the requested screen to be up.
 *
 * The app announces it on its own (`data-keres-showcase="ready"`, see `prepareShowcase.ts`) once
 * the database is up, the migrations have run and the example story is installed. Guessing from
 * the page's text, as this function used to do, produced photos of the loading screen.
 */
export async function waitForShowcase(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 90000;
      const poll = () => {
        // Two conditions: the data ready (the app's flag) and the screen already painted. The flag alone
        // still caught the loading screen, because mounting the whole drawer takes its time after the
        // data arrives.
        const dadosProntos = document.documentElement.dataset.keresShowcase === 'ready';
        const texto = (document.body?.innerText ?? '').trim();
        const pintou = texto.length > 60 && !/^(Loading|Carregando)/i.test(texto);
        if (dadosProntos && pintou) return resolve(true);
        if (Date.now() >= deadline) {
          return reject(new Error('Tempo esgotado esperando a vitrine: ' + texto.slice(0, 160)));
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  `);
}

/**
 * Real files on disk for imported media (photos/videos), reached from the renderer through
 * preload.ts's contextBridge - the renderer itself has no filesystem access. Unlike SQLite
 * (which stays on OPFS via expo-sqlite's own web implementation, already working), media
 * has no reason to live inside Chromium's sandboxed virtual filesystem on desktop: real
 * files are visible in Explorer/Finder and trivially backed up, which is exactly the kind
 * of native capability a browser tab can't offer but Electron can.
 */
const MEDIA_ROOT = path.join(app.getPath('userData'), 'media-storage');
const AUTH_VAULT_FILE = path.join(app.getPath('userData'), 'auth-vault.json');

type TokenPair = { accessToken: string; refreshToken: string };
type EncryptedTokenVault = Record<string, string>;

function isTrustedRenderer(event: Electron.IpcMainInvokeEvent): boolean {
  return isTrustedRendererUrl(event.senderFrame?.url);
}

function assertTrustedRenderer(event: Electron.IpcMainInvokeEvent): void {
  if (!isTrustedRenderer(event)) throw new Error('Unauthorized IPC sender.');
}

async function secureStorageAvailable(): Promise<boolean> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
  // Electron exposes the synchronous backend name for AppImage-style environments.
  // Flatpak uses the Secret portal through the asynchronous API instead.
  return (
    process.platform !== 'linux' ||
    Boolean(process.env.FLATPAK_ID) ||
    safeStorage.getSelectedStorageBackend() !== 'basic_text'
  );
}

async function readAuthVault(): Promise<EncryptedTokenVault> {
  try {
    return JSON.parse(await fs.readFile(AUTH_VAULT_FILE, 'utf8')) as EncryptedTokenVault;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeAuthVault(vault: EncryptedTokenVault): Promise<void> {
  // A unique name per write: two concurrent calls (say, `saveTokens` for one server and
  // `auth:remove` for another, fired close enough together) sharing the same `.tmp` made the second
  // `rename` fail with ENOENT - the first one had already consumed (moved) the temporary file.
  const tempPath = `${AUTH_VAULT_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.mkdir(path.dirname(AUTH_VAULT_FILE), { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(vault), { mode: 0o600 });
  await fs.rename(tempPath, AUTH_VAULT_FILE);
}

/**
 * Serialises every read-modify-write of the vault. Unique temporary file names (above) already
 * avoid the `rename` collision, but two concurrent calls could still step on each other another
 * way: each one reads the whole vault, changes only its own entry, and writes the whole vault
 * back - without this, the second write to finish overwrote the entire file with a copy that did
 * not have the first one's change (a silent "lost update", with no error in the log).
 */
let vaultQueue: Promise<unknown> = Promise.resolve();

function withVaultLock<T>(task: () => Promise<T>): Promise<T> {
  const result = vaultQueue.then(task, task);
  vaultQueue = result.catch(() => undefined);
  return result;
}

/** Exported so the test can register the channels without needing the app to be ready. */
export function registerAuthIpcHandlers() {
  ipcMain.handle('auth:status', async (event) => {
    assertTrustedRenderer(event);
    return { available: await secureStorageAvailable() };
  });

  ipcMain.handle('auth:read', async (event, serverId: string): Promise<TokenPair | null> => {
    assertTrustedRenderer(event);
    assertValidServerId(serverId);
    if (!(await secureStorageAvailable())) return null;
    const encrypted = (await readAuthVault())[serverId];
    if (!encrypted) return null;
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
      Buffer.from(encrypted, 'base64'),
    );
    const tokens = JSON.parse(result) as TokenPair;
    if (shouldReEncrypt) await saveTokens(serverId, tokens);
    return tokens;
  });

  ipcMain.handle('auth:write', async (event, serverId: string, tokens: TokenPair) => {
    assertTrustedRenderer(event);
    assertValidServerId(serverId);
    if (!tokens?.accessToken || !tokens?.refreshToken) throw new Error('Invalid token payload.');
    await saveTokens(serverId, tokens);
  });

  ipcMain.handle('auth:remove', async (event, serverId: string) => {
    assertTrustedRenderer(event);
    assertValidServerId(serverId);
    await withVaultLock(async () => {
      const vault = await readAuthVault();
      if (serverId in vault) {
        delete vault[serverId];
        await writeAuthVault(vault);
      }
    });
  });
}

async function saveTokens(serverId: string, tokens: TokenPair): Promise<void> {
  if (!(await secureStorageAvailable())) {
    throw new Error('Secure credential storage is unavailable on this device.');
  }
  const encrypted = (await safeStorage.encryptStringAsync(JSON.stringify(tokens))).toString(
    'base64',
  );
  await withVaultLock(async () => {
    const vault = await readAuthVault();
    vault[serverId] = encrypted;
    await writeAuthVault(vault);
  });
}

Menu.setApplicationMenu(null);

const resolveMediaPath = (relativePath: string) => resolveMediaPathIn(MEDIA_ROOT, relativePath);

/** Exported so the test can register the channels without needing the app to be ready. */
export function registerMediaIpcHandlers() {
  ipcMain.handle('media:write', async (_event, relativePath: string, bytes: Uint8Array) => {
    const filePath = resolveMediaPath(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
  });

  ipcMain.handle('media:read', async (_event, relativePath: string) => {
    const filePath = resolveMediaPath(relativePath);
    return fs.readFile(filePath);
  });

  ipcMain.handle('media:delete-file', async (_event, relativePath: string) => {
    await fs.rm(resolveMediaPath(relativePath), { force: true });
  });

  ipcMain.handle('media:delete-directory', async (_event, relativePath: string) => {
    await fs.rm(resolveMediaPath(relativePath), { recursive: true, force: true });
  });

  // Lists every file as a "media/<storyId>/<file>" relative path (matching the layout
  // webMediaRelativePath in MediaFileService.ts writes), for webMediaStore's boot-time
  // existence cache (see hydrate() in apps/client/src/services/webMediaStore.ts).
  ipcMain.handle('media:list-all', async () => {
    const results: string[] = [];
    const mediaDir = path.join(MEDIA_ROOT, 'media');
    let storyDirs: string[];
    try {
      storyDirs = await fs.readdir(mediaDir);
    } catch {
      return results;
    }
    for (const storyId of storyDirs) {
      const entries = await fs
        .readdir(path.join(mediaDir, storyId), { withFileTypes: true })
        .catch(() => []);
      for (const entry of entries) {
        if (entry.isFile()) {
          results.push(`media/${storyId}/${entry.name}`);
        }
      }
    }
    return results;
  });

  // Hands the file to the OS (the PDF reader, Word, the browser) instead of opening it inside
  // this window. `openPath` is the local-file counterpart of `openExternal`; `file:` URLs are
  // refused by the outbound-link guard on purpose.
  ipcMain.handle('media:open', async (_event, relativePath: string) => {
    const filePath = resolveMediaPath(relativePath);
    const error = await shell.openPath(filePath);
    if (error) {
      throw new Error(error);
    }
  });
}

app.whenReady().then(async () => {
  // `Cache-Control: no-store` (withIsolationHeaders above) stops *new* responses from being
  // cached, but doesn't touch whatever Chromium already cached in a previous run under this
  // same userData profile (HTTP cache and, separately, the V8 code cache) - during active
  // development that's exactly the "why am I still seeing the old build" trap. Only the
  // cache, not the profile itself: story data/settings (OPFS-backed SQLite) survive this.
  await session.defaultSession.clearCache();
  await session.defaultSession.clearCodeCaches({});

  protocol.handle(SCHEME, handleAppRequest);
  registerMediaIpcHandlers();
  registerAuthIpcHandlers();
  // BrowserWindow's `icon` option (set in createWindow) is a Windows/Linux-only concept -
  // macOS has one dock icon per app, not per window, and packaged .app icons come from
  // mac.icon in electron-builder.yml regardless. This only matters for `bun run start`'s
  // unpackaged dev run, which would otherwise show the generic Electron dock icon.
  if (process.platform === 'darwin') {
    app.dock?.setIcon(APP_ICON);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
