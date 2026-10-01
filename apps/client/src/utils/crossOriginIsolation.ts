import { isServerless } from './serverless';

/** Set before the one reload that puts the page under the worker; a second miss gives up. */
const RELOAD_FLAG = 'keres-coi-reload';

type IsolationEnv = {
  crossOriginIsolated: boolean;
  serviceWorker: ServiceWorkerContainer | undefined;
  session: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  reload: () => void;
  /** Where the isolation worker lives: the app's own base path, whatever address the page was opened at. */
  workerUrl: string;
  /** The address the page was opened at, and how to move to another one. */
  pageUrl: string;
  replace: (url: string) => void;
};

/** How long the worker gets to take control before the app boots without isolation. */
const WORKER_READY_TIMEOUT_MS = 10000;

const BUNDLE_DIRECTORY = '/_expo/static/js/web/';

/**
 * The worker's address, from where the app's own bundle was loaded. A path relative to the page breaks
 * on `/client` (no trailing slash): it resolves one level up, finds nothing, and the page boots
 * without isolation. The bundle's script tag always carries the full base path.
 */
export function workerUrlOf(): string {
  const bundle = Array.from(globalThis.document?.scripts ?? []).find((script) =>
    script.src.includes(BUNDLE_DIRECTORY),
  );
  if (bundle) {
    return `${bundle.src.slice(0, bundle.src.indexOf(BUNDLE_DIRECTORY) + 1)}coi-sw.js`;
  }
  return new URL('coi-sw.js', new URL('./', globalThis.location.href)).href;
}

function browserEnv(): IsolationEnv {
  return {
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    serviceWorker: typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
    session: globalThis.sessionStorage,
    reload: () => globalThis.location.reload(),
    workerUrl: workerUrlOf(),
    pageUrl: globalThis.location.href,
    replace: (url) => globalThis.location.replace(url),
  };
}

/**
 * Makes the serverless web build cross-origin isolated before anything opens the database.
 *
 * Web expo-sqlite needs `SharedArrayBuffer`, which needs COOP/COEP headers; GitHub Pages cannot send
 * them, so `public/coi-sw.js` adds them to every response of its scope. The first visit registers
 * the worker and reloads once under it. Resolves `true` when the app may boot now, `false` when a
 * reload is on its way. A page still not isolated after that reload boots anyway - and the database
 * error explains itself - rather than reloading forever.
 */
export async function ensureCrossOriginIsolation(
  env: IsolationEnv = browserEnv(),
): Promise<boolean> {
  if (!isServerless()) return true;
  if (env.crossOriginIsolated) {
    env.session.removeItem(RELOAD_FLAG);
    return true;
  }
  if (!env.serviceWorker || env.session.getItem(RELOAD_FLAG)) {
    env.session.removeItem(RELOAD_FLAG);
    return true;
  }
  // A worker only controls the pages under its scope, which is case-sensitive and ends in a slash:
  // opened as `/client`, or as `/keres/client` on a host that ignores case, the page itself is outside
  // it. GitHub Pages redirects the first and is case-sensitive; other hosts may not be. Moving to the
  // canonical address is what lets the worker take the page.
  const base = env.workerUrl.slice(0, env.workerUrl.lastIndexOf('/') + 1);
  const basePath = new URL(base).pathname;
  const page = new URL(env.pageUrl);
  const withSlash = page.pathname.endsWith('/') ? page.pathname : `${page.pathname}/`;
  if (
    !page.pathname.startsWith(basePath) &&
    withSlash.toLowerCase().startsWith(basePath.toLowerCase())
  ) {
    const rest = withSlash.slice(basePath.length);
    const below = page.pathname.endsWith('/') ? rest : rest.replace(/\/$/, '');
    env.replace(`${page.origin}${basePath}${below}${page.search}${page.hash}`);
    return false;
  }
  try {
    // Next to the bundle, so the worker's scope is the app's base path.
    await env.serviceWorker.register(env.workerUrl);
    // `ready` never resolves for a page outside the worker's scope: the wait is bounded, so such a
    // page boots (and says why its database fails) instead of staying blank.
    await Promise.race([
      env.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('the isolation worker did not take control')),
          WORKER_READY_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (error) {
    // Workers can be off (private windows, policies): boot, and let the database say why it fails.
    console.error('crossOriginIsolation: could not register the isolation worker.', error);
    return true;
  }
  env.session.setItem(RELOAD_FLAG, '1');
  env.reload();
  return false;
}
