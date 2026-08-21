import { Platform } from 'react-native';

/**
 * Sessão por cookie HttpOnly, só no cliente web co-hospedado pela API (HTML marcado com
 * `meta[name=keres-hosted]`). Mobile usa SecureStore; o Electron, `window.keresAuth`.
 * O `expo start --web` não tem essa meta, então não tenta cookie same-origin.
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
