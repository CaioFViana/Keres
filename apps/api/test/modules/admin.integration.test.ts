import { beforeEach, describe, expect, it } from 'vitest';
import { registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, softDeleteUser, truncateAll } from '../helpers/database';

let admin: TestUser;
let comum: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  comum = await registerUser('ana');
});

/**
 * O painel inteiro vive atrás de `requireAdmin`. Até esta suíte existir, nada verificava que
 * um usuário comum autenticado não conseguia listar contas, criar tiers ou reabrir o cadastro.
 */
describe('requireAdmin gate', () => {
  const endpoints: [string, string, unknown?][] = [
    ['GET', '/admin/api/users'],
    ['GET', '/admin/api/users/qualquer'],
    ['POST', '/admin/api/users', { username: 'x', password: 'senha-de-teste-123' }],
    ['PUT', '/admin/api/users/qualquer', { bio: 'x' }],
    ['DELETE', '/admin/api/users/qualquer'],
    ['POST', '/admin/api/users/qualquer/restore'],
    ['POST', '/admin/api/users/qualquer/reset-password'],
    ['GET', '/admin/api/tiers'],
    ['POST', '/admin/api/tiers', { name: 'Pro' }],
    ['GET', '/admin/api/registration-settings'],
    ['PUT', '/admin/api/registration-settings', { isRegistrationOpen: false }],
    ['GET', '/admin/api/recovery/deleted'],
    ['GET', '/admin/api/recovery/operation-log'],
  ];

  it.each(endpoints)('answers 401 for %s %s with no session', async (method, path, body) => {
    const { status } = await request(method, path, { body });

    expect(status).toBe(401);
  });

  it.each(endpoints)('answers 403 for %s %s as a regular user', async (method, path, body) => {
    const { status } = await request(method, path, { token: comum.token, body });

    expect(status).toBe(403);
  });

  it('re-checks isAdmin in the database, not in the token', async () => {
    const before = await request('GET', '/admin/api/users', { token: admin.token });
    expect(before.status).toBe(200);

    await softDeleteUser(admin.userId);

    const after = await request('GET', '/admin/api/users', { token: admin.token });
    expect(after.status).toBe(403);
  });
});

describe('GET /admin/api/users', () => {
  it('lists the accounts in a paginated envelope', async () => {
    const { status, data } = await request('GET', '/admin/api/users', { token: admin.token });

    expect(status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.items.map((item: any) => item.username).sort()).toEqual(['ana', 'root']);
  });

  it('never includes the password hash', async () => {
    const { data } = await request('GET', '/admin/api/users', { token: admin.token });

    expect(JSON.stringify(data)).not.toContain('$2b$');
  });

  it('filters by search term', async () => {
    const { data } = await request('GET', '/admin/api/users', { token: admin.token, query: { search: 'ana' } });

    expect(data.items.map((item: any) => item.username)).toEqual(['ana']);
  });

  it('filters by admin flag', async () => {
    const { data } = await request('GET', '/admin/api/users', { token: admin.token, query: { isAdmin: true } });

    expect(data.items.map((item: any) => item.username)).toEqual(['root']);
  });
});

describe('admin user lifecycle', () => {
  it('creates an account that can immediately log in', async () => {
    const { status, data } = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'bia', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(201);
    const login = await request('POST', '/auth/login', {
      body: { username: 'bia', password: 'senha-de-teste-123' },
    });
    expect(login.status).toBe(200);
    expect(login.data.userId).toBe(data.id);
  });

  it('refuses a username that is already taken', async () => {
    const { status } = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'ana', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(409);
  });

  /**
   * Username e tag não compartilham unicidade: criar "bia" quando outra conta já usa "bia"
   * como tag precisa cair no sufixo, e não estourar. Este era o caminho que a violação de
   * unicidade embrulhada pelo drizzle deixava morto (ver `isUniqueViolation`).
   */
  it('falls back to a suffixed tag when the username is taken as a tag', async () => {
    await request('PUT', '/user/tag', { token: comum.token, body: { tag: 'bia' } });

    const { status, data } = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'bia', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(201);
    expect(data.tag).not.toBe('bia');
    expect(data.tag).toMatch(/^bia/);
  });

  it('reads a single account by id', async () => {
    const { status, data } = await request('GET', `/admin/api/users/${comum.userId}`, { token: admin.token });

    expect(status).toBe(200);
    expect(data.username).toBe('ana');
  });

  it('answers 404 for an account that does not exist', async () => {
    const { status } = await request('GET', '/admin/api/users/nao-existe', { token: admin.token });

    expect(status).toBe(404);
  });

  it('soft-deletes and restores an account', async () => {
    const deleted = await request('DELETE', `/admin/api/users/${comum.userId}`, { token: admin.token });
    expect(deleted.status).toBe(200);
    expect(deleted.data.isDeleted).toBe(true);

    const restored = await request('POST', `/admin/api/users/${comum.userId}/restore`, { token: admin.token });
    expect(restored.status).toBe(200);
    expect(restored.data.isDeleted).toBe(false);
  });

  it('resets a password to a value the account can log in with', async () => {
    const { status, data } = await request('POST', `/admin/api/users/${comum.userId}/reset-password`, {
      token: admin.token,
    });

    expect(status).toBe(200);
    const login = await request('POST', '/auth/login', {
      body: { username: 'ana', password: data.newPassword },
    });
    expect(login.status).toBe(200);
  });

  it('promotes and demotes an account', async () => {
    await request('PUT', `/admin/api/users/${comum.userId}`, { token: admin.token, body: { isAdmin: true } });
    const promoted = await request('GET', '/admin/api/users', { token: comum.token });
    expect(promoted.status).toBe(200);

    await request('PUT', `/admin/api/users/${comum.userId}`, { token: admin.token, body: { isAdmin: false } });
    const demoted = await request('GET', '/admin/api/users', { token: comum.token });
    expect(demoted.status).toBe(403);
  });
});

describe('tiers', () => {
  it('creates a tier and lists it', async () => {
    const created = await request('POST', '/admin/api/tiers', { token: admin.token, body: { name: 'Pro' } });

    expect(created.status).toBeLessThan(300);
    const { data } = await request('GET', '/admin/api/tiers', { token: admin.token });
    expect(data.some((tier: any) => tier.name === 'Pro')).toBe(true);
  });

  it('hides a soft-deleted tier unless the caller asks for it', async () => {
    const { data: created } = await request('POST', '/admin/api/tiers', { token: admin.token, body: { name: 'Pro' } });
    await request('DELETE', `/admin/api/tiers/${created.id}`, { token: admin.token });

    const visible = await request('GET', '/admin/api/tiers', { token: admin.token });
    const all = await request('GET', '/admin/api/tiers', { token: admin.token, query: { includeDeleted: true } });

    expect(visible.data.some((tier: any) => tier.id === created.id)).toBe(false);
    expect(all.data.some((tier: any) => tier.id === created.id)).toBe(true);
  });

  it('answers 404 for a tier that does not exist', async () => {
    const { status } = await request('GET', '/admin/api/tiers/nao-existe', { token: admin.token });

    expect(status).toBe(404);
  });
});

describe('registration settings', () => {
  it('creates the singleton row on first read, without a seed step', async () => {
    const { status, data } = await request('GET', '/admin/api/registration-settings', { token: admin.token });

    expect(status).toBe(200);
    expect(data.isRegistrationOpen).toBe(true);
  });

  it('closes registration for real once the flag is off', async () => {
    await request('PUT', '/admin/api/registration-settings', {
      token: admin.token,
      body: { isRegistrationOpen: false },
    });

    const { status, data } = await request('POST', '/auth/register', {
      body: { username: 'bia', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(403);
    expect(data.message).toBe('Registration is currently closed.');
  });

  it('reopens registration', async () => {
    await request('PUT', '/admin/api/registration-settings', {
      token: admin.token,
      body: { isRegistrationOpen: false },
    });
    await request('PUT', '/admin/api/registration-settings', {
      token: admin.token,
      body: { isRegistrationOpen: true },
    });

    const { status } = await request('POST', '/auth/register', {
      body: { username: 'bia', password: 'senha-de-teste-123' },
    });

    expect(status).toBe(200);
  });
});
