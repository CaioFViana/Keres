import { Platform } from 'react-native';

/**
 * A session by HttpOnly cookie, only on the web client co-hosted by the API (HTML marked with
 * `meta[name=keres-hosted]`). Mobile uses SecureStore; Electron, `window.keresAuth`. `expo start --web`
 * does not have that meta, so it does not try a same-origin cookie.
 */

export function usesHttpOnlyCookieSession(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  if (window.keresAuth) {
    return false;
  }
  return document.querySelector('meta[name="keres-hosted"]') !== null;
}

export function hostedApiOrigin(): string {
  return window.location.origin;
}

export function canRefreshSessionWithCookie(serverUrl: string | null | undefined): boolean {
  if (!usesHttpOnlyCookieSession() || !serverUrl) {
    return false;
  }
  return normalizeOrigin(serverUrl) === hostedApiOrigin();
}

function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, '');
}
