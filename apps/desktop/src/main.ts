import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';

// package.json's "name" is "@keres/desktop" (the workspace naming convention, "@keres/*"
// everywhere) - Electron otherwise derives the userData path directly from it, and the "/"
// splits it into two real directories on disk. That confused Chromium's OPFS/File System
// Access storage backend badly enough to corrupt its lock file (SandboxOriginDatabase
// "Access denied" on .../File System/Origins/LOCK). Must be set before app.whenReady().
app.setName('Keres');

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
const SCHEME = 'app';

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
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Resolves a request path to a file under CLIENT_DIST. Expo Router's static web export
 * lays routes out as directories with their own index.html (like Next.js), but we also
 * accept a flat "route.html" export and fall back to the root index.html for anything
 * unmatched, so client-side navigation (History API) keeps working on refresh either way.
 */
function resolveFile(relativePath: string): string {
  const candidates = path.extname(relativePath)
    ? [relativePath]
    : [
        path.join(relativePath, 'index.html'),
        `${relativePath}.html`,
      ];

  for (const candidate of candidates) {
    const filePath = path.join(CLIENT_DIST, candidate);
    if (filePath.startsWith(CLIENT_DIST) && existsSync(filePath)) {
      return filePath;
    }
  }
  return path.join(CLIENT_DIST, 'index.html');
}

async function handleAppRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const relativePath = decodeURIComponent(url.pathname);
  const filePath = resolveFile(relativePath === '/' ? '/index.html' : relativePath);
  const response = await net.fetch(pathToFileURL(filePath).toString());
  return withIsolationHeaders(response);
}

async function createWindow() {
  if (!existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    throw new Error(
      `Client web export not found at ${CLIENT_DIST}. Run 'bun run build:client' (apps/desktop) first.`,
    );
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[desktop] renderer process gone:', details.reason);
  });

  await win.loadURL(`${SCHEME}://app/`);
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

/** Resolves a "media/<storyId>/<hash>.<ext>"-shaped relative path, rejecting any escape from MEDIA_ROOT. */
function resolveMediaPath(relativePath: string): string {
  const resolved = path.join(MEDIA_ROOT, relativePath);
  if (resolved !== MEDIA_ROOT && !resolved.startsWith(MEDIA_ROOT + path.sep)) {
    throw new Error(`Refusing to access path outside media storage: "${relativePath}".`);
  }
  return resolved;
}

function registerMediaIpcHandlers() {
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
      const entries = await fs.readdir(path.join(mediaDir, storyId), { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isFile()) {
          results.push(`media/${storyId}/${entry.name}`);
        }
      }
    }
    return results;
  });
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, handleAppRequest);
  registerMediaIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
