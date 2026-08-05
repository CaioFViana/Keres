import { app, BrowserWindow, protocol, net } from 'electron';
import { existsSync } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

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

app.whenReady().then(() => {
  protocol.handle(SCHEME, handleAppRequest);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
