import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual, sha256Hex } from '../../protocol/signing';
import type { ServiceState } from '../../routes';
import type { ReviewerRow } from '../../store/reviewers';

/**
 * A reviewer's session. The cookie carries a random token; the store keeps only its SHA-256, so a copied database opens
 * no session. The CSRF token of a session is derived from its cookie token: a page on another site cannot read the
 * cookie, so it cannot produce the value a form of this service must carry.
 *
 * The cookie is `HttpOnly; SameSite=Strict; Path=/review` and `Secure` unless the service's public address is plain
 * http (loopback, or ALLOW_INSECURE for a private network): the only case where the cookie may go without TLS.
 */

export const SESSION_COOKIE = 'keres_review_session';
export const REVIEW_PATH = '/review';
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface ReviewSession {
  reviewer: ReviewerRow;
  token: string;
  csrf: string;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function csrfFor(token: string): string {
  return createHmac('sha256', token).update('keres-review-csrf').digest('hex');
}

/** The value of one cookie in a `Cookie` header, or undefined. */
export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const equals = part.indexOf('=');
    if (equals >= 0 && part.slice(0, equals).trim() === name) return part.slice(equals + 1).trim();
  }
  return undefined;
}

function secureCookies(state: ServiceState): boolean {
  return new URL(state.config.publicUrl).protocol === 'https:';
}

/** The `Set-Cookie` of a session. An empty token with `maxAge` 0 clears it. */
export function sessionCookie(state: ServiceState, token: string, maxAgeSeconds: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    `Path=${REVIEW_PATH}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secureCookies(state)) parts.push('Secure');
  return parts.join('; ');
}

/** The reviewer behind the request's session, if the session is open. */
export function currentSession(
  state: ServiceState,
  request: Request,
  now: number,
): ReviewSession | undefined {
  const token = cookieValue(request.headers.get('cookie'), SESSION_COOKIE);
  if (!token || !TOKEN_PATTERN.test(token)) return undefined;
  const found = state.stores.sessions.find(sha256Hex(token), now);
  if (!found) return undefined;
  const reviewer = state.stores.reviewers.byId(found.reviewerId);
  if (!reviewer) return undefined;
  return { reviewer, token, csrf: csrfFor(token) };
}

/** Constant-time comparison of a submitted CSRF token with the session's. */
export function csrfMatches(session: ReviewSession, submitted: string | undefined): boolean {
  return submitted !== undefined && safeEqual(submitted, session.csrf);
}
