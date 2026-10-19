import { randomBytes } from 'node:crypto';

/**
 * Shared HTTP plumbing of the pages: the security headers every HTML answer carries, the nonce its one inline script
 * and style use, escaping, and the client address the rate limits count by. Nothing here knows what a page says.
 */

export type Lang = 'en' | 'pt';

/** A fresh nonce for one response. Standard base64 is a legal CSP nonce value. */
export const newNonce = (): string => randomBytes(16).toString('base64');

/**
 * The policy of every HTML page: nothing loads unless it is this page's own (or the one inline script and style that
 * carry the nonce). No `unsafe-inline`, no framing, no referrer, no caching. Images are same-origin only (the reviewer
 * pages show the decrypted documents from this origin).
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "img-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ');
}

/** The headers an HTML page carries. `camera` is granted only to the upload page (the live photo). */
export function htmlHeaders(
  nonce: string,
  options: { camera?: boolean } = {},
): Record<string, string> {
  return {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': contentSecurityPolicy(nonce),
    'x-frame-options': 'DENY',
    // `same-origin`, not `no-referrer`: with `no-referrer` a browser sends `Origin: null` on a form post, and the
    // same-origin check below would refuse every reviewer's own form. Nothing leaves this origin either way.
    'referrer-policy': 'same-origin',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'permissions-policy': options.camera
      ? 'camera=(self), microphone=()'
      : 'camera=(), microphone=()',
  };
}

export function htmlResponse(
  status: number,
  html: string,
  nonce: string,
  options: { camera?: boolean; headers?: Record<string, string> } = {},
): Response {
  return new Response(html, {
    status,
    headers: { ...htmlHeaders(nonce, options), ...options.headers },
  });
}

/** A short answer with no content to show: used where a page would tell an attacker too much. */
export function bareResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status,
    headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...headers },
  });
}

/** Redirect after a POST (or to a page the person should now see), with optional cookies. */
export function seeOther(location: string, cookies: string[] = []): Response {
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/**
 * The address a rate limit counts by. The service sits behind the operator's reverse proxy, which appends the address
 * it saw to `X-Forwarded-For`; the rightmost entry is the one a client cannot forge through that proxy. Without a
 * proxy the header is the client's to set, so limits are only as strong as the deployment: see the README.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const last = forwarded?.split(',').pop()?.trim();
  return last ? last.slice(0, 64) : 'direct';
}

/**
 * Whether a state-changing request comes from this service's own pages. A browser sends `Origin` on a form post; a
 * post from another site carries that site's origin and is refused. No `Origin` (old clients, tests) is allowed: the
 * per-form CSRF token is the check that always applies.
 */
export function sameOriginOrAbsent(request: Request, publicUrl: string): boolean {
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(publicUrl).origin;
}

/** Whether the client asked for JSON (the upload page's own script does; a plain form post does not). */
export function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}
