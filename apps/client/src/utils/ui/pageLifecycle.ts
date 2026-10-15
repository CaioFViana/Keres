import { Platform } from 'react-native';

const noop = () => {};

/**
 * Keeps the web page out of the browser's back/forward cache, so leaving it really ends it.
 *
 * The database file lives in the browser's private file system and a worker holds it open for as long
 * as the page lives. A page that only went into the back/forward cache is still alive - still holding
 * the file - and the next visit to the app fails with "Access Handles cannot be created". Closing the
 * database as the page is left does not release it in time; making the page ineligible for the cache
 * does: browsers destroy such a page (and its worker) on leaving.
 *
 * Two things keep a page out, for the browsers that honor either: an `unload` listener, and a Web Lock
 * held for the page's whole life (the lock also makes a stuck page visible to the next one).
 * Returns what undoes both. A no-op off the web.
 */
export function keepPageOutOfBackForwardCache(): () => void {
  if (Platform.OS !== 'web' || typeof globalThis.addEventListener !== 'function') return noop;

  globalThis.addEventListener('unload', noop);

  let releaseLock = noop;
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (locks?.request) {
    locks
      .request('keres-page-alive', () => new Promise<void>((resolve) => (releaseLock = resolve)))
      .catch(noop);
  }

  return () => {
    globalThis.removeEventListener('unload', noop);
    releaseLock();
  };
}
