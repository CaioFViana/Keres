import { beforeEach, describe, expect, it } from 'vitest';
import { softDeleteUser, truncateAll } from '../helpers/database';
import { newId, registerUser, request } from '../helpers/app';

beforeEach(truncateAll);

describe('POST /auth/register', () => {
  it('creates an account and hands back a usable session', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      body: { username: 'ana', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ username: 'ana', tag: 'ana' });
    expect(data.userId).toMatch(/^[0-9A-Z]{26}$/);
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');
  });

  it('sets the session cookies alongside the tokens', async () => {
    const { headers } = await request('POST', '/auth/register', {
      body: { username: 'ana', password: 'senha-de-teste-123' },
    });

    const cookies = headers.getSetCookie().join(';');
    expect(cookies).toContain('access_token=');
    expect(cookies).toContain('refresh_token=');
    expect(cookies.toLowerCase()).toContain('httponly');
  });

  it('refuses a username that is already taken', async () => {
    await registerUser('ana');

    const { status, data } = await request('POST', '/auth/register', {
      body: { username: 'ana', password: 'outra-senha-123' },
    });

    expect(status).toBe(409);
    expect(data.message).toBe('User already exists');
  });

  it('falls back to a suffixed tag when another account already claimed that tag', async () => {
    const first = await registerUser('ana');
    await request('PUT', '/user/tag', { token: first.token, body: { tag: 'bia' } });

    const { status, data } = await request('POST', '/auth/register', {
      body: { username: 'bia', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(200);
    expect(data.username).toBe('bia');
    expect(data.tag).not.toBe('bia');
    expect(data.tag).toMatch(/^bia/);
  });

  it('rejects a body that is missing the password', async () => {
    const { status } = await request('POST', '/auth/register', { body: { username: 'ana' } });

    expect(status).toBe(422);
  });

  /**
   * Two concurrent registrations for the same username can both pass the pre-check before
   * either commits, so the real gate is what the *insert* does when the second one hits the
   * database's unique constraint. That catch block used to assume any unique violation was a
   * `tag` collision and blindly retried with a suffixed tag while reusing the same username -
   * which would just fail again on the *username* constraint, this time unhandled (a raw 500),
   * instead of the clean 409 a duplicate registration should get.
   */
  it('resolves a race between two registrations for the same username into one success and one clean 409', async () => {
    const username = `race_${newId().toLowerCase()}`;

    const [first, second] = await Promise.all([
      request('POST', '/auth/register', { body: { username, password: 'senha-de-teste-123' } }),
      request('POST', '/auth/register', { body: { username, password: 'outra-senha-456' } }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const rejected = first.status === 409 ? first : second;
    expect(rejected.data.message).toBe('User already exists');
  });
});

describe('POST /auth/login', () => {
  it('authenticates a registered user', async () => {
    const user = await registerUser('ana');

    const { status, data } = await request('POST', '/auth/login', {
      body: { username: 'ana', password: user.password },
    });

    expect(status).toBe(200);
    expect(data.userId).toBe(user.userId);
    expect(typeof data.accessToken).toBe('string');
  });

  it('rejects a wrong password without saying which field was wrong', async () => {
    await registerUser('ana');

    const { status, data } = await request('POST', '/auth/login', {
      body: { username: 'ana', password: 'senha-errada' },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid credentials');
  });

  it('gives the same answer for a user that does not exist', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      body: { username: 'ninguem', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid credentials');
  });

  it('never returns the stored password hash', async () => {
    const user = await registerUser('ana');

    const { data } = await request('POST', '/auth/login', {
      body: { username: 'ana', password: user.password },
    });

    expect(JSON.stringify(data)).not.toContain('$2b$');
    expect(data.password).toBeUndefined();
  });

  /**
   * A soft-deleted account used to still authenticate normally (the lookup never filtered
   * isDeleted) and only got blocked later by admin-gated routes - an admin "deleting" a user
   * didn't actually cut off API access. Same message/status as a wrong password: a deleted
   * account shouldn't be distinguishable from a nonexistent one.
   */
  it('rejects a soft-deleted account exactly like a nonexistent one', async () => {
    const user = await registerUser('ana');
    await softDeleteUser(user.userId);

    const { status, data } = await request('POST', '/auth/login', {
      body: { username: 'ana', password: user.password },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid credentials');
  });
});

describe('POST /auth/refresh', () => {
  it('exchanges a refresh token for a fresh pair', async () => {
    const user = await registerUser('ana');

    const { status, data } = await request('POST', '/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });

    expect(status).toBe(200);
    expect(data.username).toBe('ana');
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');
  });

  it('returns a token that actually authenticates', async () => {
    const user = await registerUser('ana');
    const { data } = await request('POST', '/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });

    const { status } = await request('POST', '/auth/ws-ticket', { token: data.accessToken });

    expect(status).toBe(200);
  });

  it('rejects a request with no refresh token at all', async () => {
    const { status, data } = await request('POST', '/auth/refresh', { body: {} });

    expect(status).toBe(401);
    expect(data.message).toBe('Refresh token not found');
  });

  it('rejects a malformed refresh token', async () => {
    const { status, data } = await request('POST', '/auth/refresh', {
      body: { refreshToken: 'nao-e-um-jwt' },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid or expired refresh token');
  });

  it('refuses an access token used in place of a refresh token', async () => {
    const user = await registerUser('ana');

    const { status } = await request('POST', '/auth/refresh', {
      body: { refreshToken: user.token },
    });

    expect(status).toBe(401);
  });

  /**
   * The refresh token alone used to be enough - it only proves it was validly issued at some
   * point in the past, not that the account is still enabled. Without a DB re-check here, a
   * deleted/banned user kept minting fresh access tokens off a still-valid refresh token
   * forever (there's no revocation list). The refresh token is minted *before* the delete, same
   * as a real client that was logged in when an admin removed their account.
   */
  it('rejects a refresh token for an account that was soft-deleted after it was issued', async () => {
    const user = await registerUser('ana');
    await softDeleteUser(user.userId);

    const { status, data } = await request('POST', '/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid or expired refresh token');
  });
});

describe('POST /auth/logout', () => {
  it('clears session cookies and remains idempotent when already logged out', async () => {
    const user = await registerUser('ana');

    const loggedOut = await request('POST', '/auth/logout', {
      headers: { cookie: `access_token=${user.token}; refresh_token=${user.refreshToken}` },
    });
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.data.message).toBe('Logged out');

    const setCookies = loggedOut.headers.getSetCookie().join(';').toLowerCase();
    expect(setCookies).toMatch(/access_token=/);
    expect(setCookies).toMatch(/refresh_token=/);
    expect(setCookies).toMatch(/max-age=0/);

    const again = await request('POST', '/auth/logout', { body: {} });
    expect(again.status).toBe(200);
    expect(again.data.message).toBe('Logged out');
  });
});

describe('POST /auth/login rate limiting', () => {
  /**
   * /login had no attempt limiting at all until this - the concept was introduced with
   * /forgot-password and just never backported. Uses a unique auto-generated username (not
   * 'ana', which other tests in this file also log into with a wrong password) so this test's
   * count isn't polluted by - or doesn't pollute - anyone else's, since the limiter is a
   * module-level singleton shared for the process's lifetime.
   */
  it('locks out further attempts after 5 failed logins, even with the correct password on the 6th', async () => {
    const user = await registerUser();

    for (let attempt = 0; attempt < 5; attempt++) {
      const { status, data } = await request('POST', '/auth/login', {
        body: { username: user.username, password: 'senha-errada' },
      });
      expect(status).toBe(401);
      expect(data.message).toBe('Invalid credentials');
    }

    const { status, data } = await request('POST', '/auth/login', {
      body: { username: user.username, password: user.password },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid credentials');
  });

  it('does not lock out a different username', async () => {
    const lockedOut = await registerUser();
    const unaffected = await registerUser();

    for (let attempt = 0; attempt < 5; attempt++) {
      await request('POST', '/auth/login', {
        body: { username: lockedOut.username, password: 'senha-errada' },
      });
    }

    const { status, data } = await request('POST', '/auth/login', {
      body: { username: unaffected.username, password: unaffected.password },
    });

    expect(status).toBe(200);
    expect(data.userId).toBe(unaffected.userId);
  });
});

describe('POST /auth/forgot-password', () => {
  /**
   * Same reasoning as login/refresh: without filtering isDeleted here too, a soft-deleted
   * account could bypass the login block simply by resetting its password through recovery
   * instead - which would completely defeat the point of blocking it at login.
   */
  it('rejects a soft-deleted account exactly like a nonexistent one', async () => {
    const { data: registered } = await request('POST', '/auth/register', {
      body: { username: 'ana', password: 'senha-de-teste-123' },
    });
    await softDeleteUser(registered.userId);

    const { status, data } = await request('POST', '/auth/forgot-password', {
      body: {
        username: 'ana',
        recoveryCode: registered.recoveryCodes[0],
        newPassword: 'nova-senha-123',
      },
    });

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid username or recovery code.');
  });
});

describe('authentication guard', () => {
  it('rejects a protected route with no credentials', async () => {
    const { status } = await request('PUT', '/user/profile', { body: { bio: 'oi' } });

    expect(status).toBe(401);
  });

  it('rejects a token that was not signed by this server', async () => {
    const forged =
      'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4IiwidXNlcm5hbWUiOiJ4In0.assinatura-invalida';

    const { status } = await request('POST', '/auth/ws-ticket', { token: forged });

    expect(status).toBe(401);
  });

  it('accepts the session cookie when there is no Authorization header', async () => {
    const user = await registerUser('ana');

    const { status } = await request('POST', '/auth/ws-ticket', {
      headers: { cookie: `access_token=${user.token}` },
    });

    expect(status).toBe(200);
  });
});

describe('GET /auth/me', () => {
  it('returns the account from a Bearer token', async () => {
    const user = await registerUser('ana');

    const { status, data } = await request('GET', '/auth/me', { token: user.token });

    expect(status).toBe(200);
    expect(data).toEqual({ userId: user.userId, username: 'ana', tag: 'ana' });
  });

  it('returns the account from the session cookie alone', async () => {
    const user = await registerUser('ana');

    const { status, data } = await request('GET', '/auth/me', {
      headers: { cookie: `access_token=${user.token}` },
    });

    expect(status).toBe(200);
    expect(data).toEqual({ userId: user.userId, username: 'ana', tag: 'ana' });
  });

  it('rejects a missing session', async () => {
    const { status } = await request('GET', '/auth/me');

    expect(status).toBe(401);
  });
});

describe('POST /auth/ws-ticket', () => {
  it('issues a short-lived ticket to an authenticated user', async () => {
    const user = await registerUser('ana');

    const { status, data } = await request('POST', '/auth/ws-ticket', { token: user.token });

    expect(status).toBe(200);
    expect(typeof data.ticket).toBe('string');
    expect(data.expiresInSeconds).toBe(30);
  });

  it('refuses to issue a ticket without a session', async () => {
    const { status } = await request('POST', '/auth/ws-ticket');

    expect(status).toBe(401);
  });
});
