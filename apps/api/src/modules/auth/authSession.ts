import type { Cookie } from 'elysia';
import { env } from '../../config/env';

/**
 * Sets the hosted web client's session cookies: the access token for one hour, the refresh token for
 * seven days. Every route that starts a session uses this, so the flags cannot drift between them.
 */
export function setSessionCookies(
  cookie: Record<string, Cookie<unknown>>,
  accessToken: string,
  refreshToken: string,
) {
  cookie['access_token'].set({
    value: accessToken,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600, // 1 hour
  });

  cookie['refresh_token'].set({
    value: refreshToken,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600, // 7 days
  });
}
