import { CLIENT_APP_ISOLATION_HEADERS } from './hostedClient';

/**
 * Headers for the co-hosted admin SPA and the public site (static assets + HTML fallback). Not applied to
 * `/api/admin/*`. `blob:` images are allowed because the public site draws a story's cover from a picture it fetched
 * with the viewer's own credentials (a protected or adults-only story answers only to them).
 */
const ADMIN_UI_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

export function applyAdminUiSecurityHeaders(set: {
  headers: Record<string, string | number>;
}): void {
  for (const [name, value] of Object.entries(ADMIN_UI_SECURITY_HEADERS)) {
    set.headers[name] = value;
  }
}

export function applyClientAppIsolationHeaders(set: {
  headers: Record<string, string | number>;
}): void {
  for (const [name, value] of Object.entries(CLIENT_APP_ISOLATION_HEADERS)) {
    set.headers[name] = value;
  }
}
