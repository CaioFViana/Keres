import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
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
    ['POST', '/admin/api/users/qualquer/regenerate-recovery-codes'],
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
    const { data } = await request('GET', '/admin/api/users', {
      token: admin.token,
      query: { search: 'ana' },
    });

    expect(data.items.map((item: any) => item.username)).toEqual(['ana']);
  });

  it('filters by admin flag', async () => {
    const { data } = await request('GET', '/admin/api/users', {
      token: admin.token,
      query: { isAdmin: true },
    });

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
   * Same fix as /auth/register's own race test: two concurrent creates for the same username
   * can both pass the pre-check before either commits, so the real gate is the insert's catch
   * block correctly telling a *username* collision apart from a *tag* one instead of blindly
   * retrying with a suffixed tag and crashing on the username constraint a second time.
   */
  it('resolves a race between two creates for the same username into one success and one clean 409', async () => {
    const username = `race_${newId().toLowerCase()}`;

    const [first, second] = await Promise.all([
      request('POST', '/admin/api/users', {
        token: admin.token,
        body: { username, password: 'senha-de-teste-123' },
      }),
      request('POST', '/admin/api/users', {
        token: admin.token,
        body: { username, password: 'outra-senha-456' },
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const rejected = first.status === 409 ? first : second;
    expect(rejected.data.message).toBe('Username is already taken.');
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
    const { status, data } = await request('GET', `/admin/api/users/${comum.userId}`, {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data.username).toBe('ana');
  });

  it('answers 404 for an account that does not exist', async () => {
    const { status } = await request('GET', '/admin/api/users/nao-existe', { token: admin.token });

    expect(status).toBe(404);
  });

  it('soft-deletes and restores an account', async () => {
    const deleted = await request('DELETE', `/admin/api/users/${comum.userId}`, {
      token: admin.token,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.data.isDeleted).toBe(true);

    const restored = await request('POST', `/admin/api/users/${comum.userId}/restore`, {
      token: admin.token,
    });
    expect(restored.status).toBe(200);
    expect(restored.data.isDeleted).toBe(false);
  });

  it('regenerates recovery codes the account can use to reset its own password', async () => {
    const { status, data } = await request(
      'POST',
      `/admin/api/users/${comum.userId}/regenerate-recovery-codes`,
      {
        token: admin.token,
      },
    );

    expect(status).toBe(200);
    expect(data.recoveryCodes).toHaveLength(8);

    const reset = await request('POST', '/auth/forgot-password', {
      body: {
        username: 'ana',
        recoveryCode: data.recoveryCodes[0],
        newPassword: 'a-brand-new-password',
      },
    });
    expect(reset.status).toBe(200);

    const login = await request('POST', '/auth/login', {
      body: { username: 'ana', password: 'a-brand-new-password' },
    });
    expect(login.status).toBe(200);
  });

  it('promotes and demotes an account', async () => {
    await request('PUT', `/admin/api/users/${comum.userId}`, {
      token: admin.token,
      body: { isAdmin: true },
    });
    const promoted = await request('GET', '/admin/api/users', { token: comum.token });
    expect(promoted.status).toBe(200);

    await request('PUT', `/admin/api/users/${comum.userId}`, {
      token: admin.token,
      body: { isAdmin: false },
    });
    const demoted = await request('GET', '/admin/api/users', { token: comum.token });
    expect(demoted.status).toBe(403);
  });
});

describe('tiers', () => {
  it('creates a tier and lists it', async () => {
    const created = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Pro' },
    });

    expect(created.status).toBeLessThan(300);
    const { data } = await request('GET', '/admin/api/tiers', { token: admin.token });
    expect(data.some((tier: any) => tier.name === 'Pro')).toBe(true);
  });

  it('hides a soft-deleted tier unless the caller asks for it', async () => {
    const { data: created } = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Pro' },
    });
    await request('DELETE', `/admin/api/tiers/${created.id}`, { token: admin.token });

    const visible = await request('GET', '/admin/api/tiers', { token: admin.token });
    const all = await request('GET', '/admin/api/tiers', {
      token: admin.token,
      query: { includeDeleted: true },
    });

    expect(visible.data.some((tier: any) => tier.id === created.id)).toBe(false);
    expect(all.data.some((tier: any) => tier.id === created.id)).toBe(true);
  });

  it('answers 404 for a tier that does not exist', async () => {
    const { status } = await request('GET', '/admin/api/tiers/nao-existe', { token: admin.token });

    expect(status).toBe(404);
  });

  it('reads and updates a tier without losing its configured limits', async () => {
    const { data: created } = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: {
        name: 'Pro',
        maxStories: 5,
        maxEntitiesPerStory: null,
        maxEntitiesTotal: null,
        maxStorageBytesPerStory: null,
        maxStorageBytesTotal: null,
      },
    });

    const read = await request('GET', `/admin/api/tiers/${created.id}`, { token: admin.token });
    const updated = await request('PUT', `/admin/api/tiers/${created.id}`, {
      token: admin.token,
      body: { name: 'Pro Plus', maxStories: 10 },
    });

    expect(read.status).toBe(200);
    expect(read.data).toMatchObject({ id: created.id, maxStories: 5 });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({ name: 'Pro Plus', maxStories: 10 });
  });

  it('rejects duplicate tier names on creation and rename', async () => {
    const first = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Free' },
    });
    const duplicate = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Free' },
    });
    const second = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Pro' },
    });
    const rename = await request('PUT', `/admin/api/tiers/${second.data.id}`, {
      token: admin.token,
      body: { name: first.data.name },
    });

    expect(duplicate.status).toBe(409);
    expect(rename.status).toBe(409);
  });

  it('refuses to delete a tier that is used by registration defaults or active users', async () => {
    const defaultTier = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Default' },
    });
    await request('PUT', '/admin/api/registration-settings', {
      token: admin.token,
      body: { defaultTierId: defaultTier.data.id },
    });
    const defaultDelete = await request('DELETE', `/admin/api/tiers/${defaultTier.data.id}`, {
      token: admin.token,
    });

    const assignedTier = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Assigned' },
    });
    await request('PUT', `/admin/api/users/${comum.userId}`, {
      token: admin.token,
      body: { tierId: assignedTier.data.id },
    });
    const assignedDelete = await request('DELETE', `/admin/api/tiers/${assignedTier.data.id}`, {
      token: admin.token,
    });

    expect(defaultDelete.status).toBe(409);
    expect(defaultDelete.data.message).toMatch(/default tier/i);
    expect(assignedDelete.status).toBe(409);
    expect(assignedDelete.data.message).toMatch(/active users/i);
  });

  it('validates tier inputs before applying them', async () => {
    const invalidCreate = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: '' },
    });
    const invalidUpdate = await request('PUT', `/admin/api/tiers/${newId()}`, {
      token: admin.token,
      body: { maxStories: -1 },
    });

    expect(invalidCreate.status).toBe(400);
    expect(invalidUpdate.status).toBe(400);
  });
});

describe('registration settings', () => {
  it('creates the singleton row on first read, without a seed step', async () => {
    const { status, data } = await request('GET', '/admin/api/registration-settings', {
      token: admin.token,
    });

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
