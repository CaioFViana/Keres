import { Platform } from 'react-native';

/**
 * Sessão por cookie HttpOnly, só no cliente web hospedado pela própria API (`/app`).
 *
 * Mobile e o Electron não entram aqui: o nativo usa SecureStore; o desktop, `window.keresAuth`.
 * O `expo start --web` também não — o Metro não vive em `/app`, então o cookie same-origin
 * da API nem seria enviado.
 */

export function usesHttpOnlyCookieSession(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  if (window.keresAuth) {
    return false;
  }
  return window.location.pathname.startsWith('/app');
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
