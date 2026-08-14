import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAll } from '../helpers/database';
import { registerUser, request } from '../helpers/app';

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
