import { KERES_OFFICIAL_URL } from '@keres/shared';
import { hostedApiOrigin } from '@/src/services/auth/browserCookieSession';
import { isHostedByApi } from '@/src/utils/platform/clientFlavor';
import { normalizeServerUrl } from '@/src/utils/auth/serverUrl';

/**
 * The server the app points a person at: the one that serves the hosted web client (it can talk to no
 * other), and the official Keres server everywhere else.
 */
export function defaultServerUrl(): string {
  return isHostedByApi() ? hostedApiOrigin() : KERES_OFFICIAL_URL;
}

/** Whether this address is the default server's, however it was typed (case, trailing slash, default port). */
export function isDefaultServerUrl(url: string): boolean {
  return normalizeServerUrl(url) === normalizeServerUrl(defaultServerUrl());
}

/** Whether this address is the official Keres server's, wherever the client is hosted. */
export function isOfficialServerUrl(url: string): boolean {
  return normalizeServerUrl(url) === normalizeServerUrl(KERES_OFFICIAL_URL);
}

/**
 * What a server is called on screen. The official server has no name of its own to type (its form
 * hides the field, so the saved name is just its address): it is "Official server", from a
 * translation key, so the name follows the language and is never stored. Any other server shows
 * the name it was given, or its address when it was given none.
 */
export function serverDisplayName(
  server: { name?: string | null; url?: string },
  t: (key: string) => string,
): string {
  const name = server.name?.trim();
  const { url } = server;
  const named = !!name && (!url || normalizeServerUrl(name) !== normalizeServerUrl(url));
  if (!named && url && isOfficialServerUrl(url)) return t('official_server_name');
  return name || url || '';
}
