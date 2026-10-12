import { AppError } from '../../utils/errors';

/**
 * What a session of a pending account may still reach (see `docs/age_verification.md`, "Registration in required
 * mode"). A pending account is useless until the service approves it: its session carries the `pending` claim, and the
 * request pipeline refuses that claim everywhere except on this list. The check reads only the token - no database
 * hit per request - so the list is the whole rule.
 */
interface AllowedRoute {
  method: 'GET' | 'POST' | '*';
  /** The path after the `/api` prefix. */
  path: string;
  /** Also every path below it, not only the path itself. */
  prefix?: boolean;
}

const ALLOWED_FOR_PENDING: readonly AllowedRoute[] = [
  { method: 'GET', path: '/auth/verification' },
  { method: 'POST', path: '/auth/verification/retry' },
  { method: 'POST', path: '/auth/refresh' },
  // These do not act as the caller: a stale pending token left on a device must not stop a fresh sign-in or sign-up.
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/auth/forgot-password' },
  { method: 'POST', path: '/auth/logout' },
  { method: 'GET', path: '/auth/terms-status' },
  { method: 'POST', path: '/auth/terms-accept' },
  { method: 'GET', path: '/keres-tos' },
  { method: 'GET', path: '/keres-privacy' },
  { method: 'GET', path: '/kerescheck' },
  { method: '*', path: '/age-verification', prefix: true },
  { method: '*', path: '/public', prefix: true },
];

export const VERIFICATION_PENDING_CODE = 'verification_pending';
export const VERIFICATION_PENDING_MESSAGE = 'Verify your age to use this account.';

const API_PREFIX = '/api';

/** Whether a request on `method` to `pathname` is one a pending session may make. Pure. */
export function pendingSessionMayReach(method: string, pathname: string): boolean {
  const path = pathname.slice(API_PREFIX.length);
  const upper = method.toUpperCase();
  return ALLOWED_FOR_PENDING.some((route) => {
    if (route.method !== '*' && route.method !== upper) return false;
    if (path === route.path) return true;
    return !!route.prefix && path.startsWith(`${route.path}/`);
  });
}

/**
 * Refuses a pending session outside the list. Only the `/api` tree is gated: the hosted pages and their static files
 * are the same for everybody, and they carry no session of their own.
 */
export function assertPendingSessionMayReach(request: Request): void {
  const { method, url } = request;
  const pathname = new URL(url).pathname;
  if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) return;
  if (pendingSessionMayReach(method, pathname)) return;
  throw new AppError(403, VERIFICATION_PENDING_MESSAGE, VERIFICATION_PENDING_CODE);
}
