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
