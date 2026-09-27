import { isServerless } from './serverless';

/** Set before the one reload that puts the page under the worker; a second miss gives up. */
const RELOAD_FLAG = 'keres-coi-reload';

type IsolationEnv = {
  crossOriginIsolated: boolean;
  serviceWorker: ServiceWorkerContainer | undefined;
  session: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  reload: () => void;
};

function browserEnv(): IsolationEnv {
  return {
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    serviceWorker: typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
    session: globalThis.sessionStorage,
    reload: () => globalThis.location.reload(),
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
  try {
    // Relative to the page, so the worker's scope is the app's base path.
    await env.serviceWorker.register('coi-sw.js');
    await env.serviceWorker.ready;
  } catch (error) {
    // Workers can be off (private windows, policies): boot, and let the database say why it fails.
    console.error('crossOriginIsolation: could not register the isolation worker.', error);
    return true;
  }
  env.session.setItem(RELOAD_FLAG, '1');
  env.reload();
  return false;
}
