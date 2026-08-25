const TRUSTED_RENDERER_SCHEME = 'app:';
const TRUSTED_RENDERER_HOST = 'app';
const SERVER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Checks the origin before accepting an IPC call from the renderer. */
export function isTrustedRendererUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === TRUSTED_RENDERER_SCHEME &&
      parsed.hostname === TRUSTED_RENDERER_HOST &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

/** Server ids also become key names in the local vault; they cannot contain paths. */
export function assertValidServerId(serverId: string): void {
  if (!SERVER_ID_PATTERN.test(serverId)) throw new Error('Invalid server identifier.');
}

/**
 * Addresses that should leave the app and open in the system browser.
 *
 * Keres desktop is an app's window, not a browser: opening a story's public page (or any other
 * site) inside it would leave the person stuck in a Chromium with no address bar, no history and
 * none of the logins they already have. Only `http`/`https` leave - any other scheme (`file:`,
 * `app:`, and especially things like `javascript:`) is refused, so a link cannot become a way to
 * make the operating system run something.
 */
export function isExternalBrowserUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Whether this navigation leaves the application - that is, it is not the trusted renderer itself. */
export function isInAppNavigation(url: string | undefined): boolean {
  return isTrustedRendererUrl(url);
}
