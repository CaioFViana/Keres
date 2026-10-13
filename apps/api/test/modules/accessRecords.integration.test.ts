import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { accessRecords, auditEvents } from '../../src/db/schema';
import { accessRecordService } from '../../src/services/AccessRecordService';
import { getApp, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

/** The address the test requests come from, as a real listener would report it. */
const ADDRESS = '203.0.113.7';
const PASSWORD = 'senha-de-teste-123';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;

/**
 * Runs `call` as if every request it makes came from `address`: the suites run the app in memory, so the address is
 * handed to the routes through the server the app reports (the same `requestIP` a real socket provides).
 */
async function from<T>(address: string, call: () => Promise<T>): Promise<T> {
  const app = await getApp();
  const previous = app.server;
  app.server = {
    requestIP: () => ({ address, family: 'IPv4', port: 0 }),
  } as unknown as typeof app.server;
  try {
    return await call();
  } finally {
    app.server = previous;
  }
}

/** The records are written after the response, without anybody waiting: wait until `count` are there. */
async function recordsOf(count: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await db.select().from(accessRecords);
    if (rows.length >= count) return rows;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return db.select().from(accessRecords);
}

/** The activity record, waited for the same way. */
async function activityOf(action: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.action, action));
    if (rows.length > 0) return rows;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return db.select().from(auditEvents).where(eq(auditEvents.action, action));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

const search = (query: Record<string, string | number | boolean | undefined>) =>
  request('GET', '/admin/api/access-records', { token: admin.token, query });

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  // Registering wrote records of its own: each test starts from none.
  await settle();
  await db.delete(accessRecords);
  await db.delete(auditEvents);
});

describe('what is recorded: the moments that establish a session', () => {
  it('records one successful sign-in with the account and the address, and nothing else', async () => {
    const { status } = await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: 'ana', password: PASSWORD } }),
    );
    expect(status).toBe(200);

    const rows = await recordsOf(1);
    await settle();
    expect(await db.select().from(accessRecords)).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'login',
      userId: ana.userId,
      usernameTried: null,
      ip: ADDRESS,
    });
  });

  it('records a wrong password against the account it names, and the reason never', async () => {
    await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: 'ana', password: 'nao-e-essa-1' } }),
    );

    const [row] = await recordsOf(1);
    expect(row).toMatchObject({ event: 'login_failed', userId: ana.userId, usernameTried: null });
    expect(JSON.stringify(row)).not.toContain('nao-e-essa-1');
  });

  it('records a name that matches no account with that name kept, and no account behind it', async () => {
    await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: 'fantasma', password: 'whatever1' } }),
    );

    const [row] = await recordsOf(1);
    expect(row).toMatchObject({ event: 'login_failed', userId: null, usernameTried: 'fantasma' });
  });

  it('clips a name tried to 64 characters', async () => {
    const long = 'x'.repeat(90);
    await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: long, password: 'whatever1' } }),
    );

    const [row] = await recordsOf(1);
    expect(row.usernameTried).toBe('x'.repeat(64));
  });

  it('records a refused sign-in by the limit on guesses too, as a failure', async () => {
    for (let i = 0; i < 6; i++) {
      await from(ADDRESS, () =>
        request('POST', '/auth/login', { body: { username: 'bia', password: `errada-${i}-xx` } }),
      );
    }

    await recordsOf(6);
    await settle();
    const all = await db.select().from(accessRecords);
    expect(all).toHaveLength(6);
    expect(all.every((row) => row.event === 'login_failed' && row.userId === bia.userId)).toBe(
      true,
    );
  });

  it('records a deleted account that tries to sign in against that account, not as a name nobody has', async () => {
    await request('DELETE', '/user/account', {
      token: bia.token,
      body: { currentPassword: PASSWORD },
    });

    await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: 'bia', password: PASSWORD } }),
    );

    const [row] = await recordsOf(1);
    expect(row).toMatchObject({ event: 'login_failed', userId: bia.userId, usernameTried: null });
  });

  it('records a registration that worked, and no refused one', async () => {
    const created = await from(ADDRESS, () =>
      request('POST', '/auth/register', { body: { username: 'caio', password: PASSWORD } }),
    );
    expect(created.status).toBe(200);
    const taken = await from(ADDRESS, () =>
      request('POST', '/auth/register', { body: { username: 'ana', password: PASSWORD } }),
    );
    expect(taken.status).toBe(409);

    await recordsOf(1);
    await settle();
    const all = await db.select().from(accessRecords);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ event: 'register', userId: created.data.userId, ip: ADDRESS });
  });

  it('records a password recovered with a code, and a recovery that failed for a name nobody has', async () => {
    const created = await request('POST', '/auth/register', {
      body: { username: 'dani', password: PASSWORD },
    });
    const code = created.data.recoveryCodes[0];
    // The record of the registration is written after the answer: let it land before clearing it.
    await settle();
    await db.delete(accessRecords);

    const failed = await from(ADDRESS, () =>
      request('POST', '/auth/forgot-password', {
        body: {
          username: 'ninguem',
          recoveryCode: 'AAAA-BBBB-CCCC',
          newPassword: 'nova-senha-123',
        },
      }),
    );
    expect(failed.status).toBe(401);
    const recovered = await from(ADDRESS, () =>
      request('POST', '/auth/forgot-password', {
        body: { username: 'dani', recoveryCode: code, newPassword: 'nova-senha-123' },
      }),
    );
    expect(recovered.status).toBe(200);

    await recordsOf(2);
    await settle();
    const all = await db.select().from(accessRecords);
    expect(all).toHaveLength(2);
    expect(all.find((row) => row.event === 'password_recovery_failed')).toMatchObject({
      userId: null,
      usernameTried: 'ninguem',
      ip: ADDRESS,
    });
    expect(all.find((row) => row.event === 'password_recovery')).toMatchObject({
      userId: created.data.userId,
      usernameTried: null,
    });
  });

  it('records a session renewed, and a refresh that was refused not at all', async () => {
    const renewed = await from(ADDRESS, () =>
      request('POST', '/auth/refresh', { body: { refreshToken: ana.refreshToken } }),
    );
    expect(renewed.status).toBe(200);
    const refused = await from(ADDRESS, () =>
      request('POST', '/auth/refresh', { body: { refreshToken: 'nao-e-um-token' } }),
    );
    expect(refused.status).toBe(401);

    await recordsOf(1);
    await settle();
    const all = await db.select().from(accessRecords);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ event: 'token_refresh', userId: ana.userId, ip: ADDRESS });
  });

  it('writes nothing for ordinary calls, however many', async () => {
    for (let i = 0; i < 3; i++) {
      await request('GET', '/user/me', { token: ana.token });
      await request('GET', '/auth/me', { token: ana.token });
      await request('GET', '/friend/', { token: ana.token });
    }
    await request('GET', '/admin/api/access-records', { token: admin.token });

    await settle();
    expect(await db.select().from(accessRecords)).toHaveLength(0);
  });
});

describe('the address on a record', () => {
  it('is the real client behind a reverse proxy: the one the proxy appended, not one the client forged', async () => {
    // The socket is the proxy on this machine; the client wrote a false address in front of the real one.
    await from('127.0.0.1', () =>
      request('POST', '/auth/login', {
        body: { username: 'ana', password: PASSWORD },
        headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.9' },
      }),
    );

    const [row] = await recordsOf(1);
    expect(row.ip).toBe('198.51.100.9');
  });

  it('is unknown, not empty, when no address can be read', async () => {
    await request('POST', '/auth/login', { body: { username: 'ana', password: PASSWORD } });

    const [row] = await recordsOf(1);
    expect(row.ip).toBe('unknown');
  });
});

describe('the retention', () => {
  it('drops the records older than the days it keeps, and nothing newer', async () => {
    const now = new Date();
    await accessRecordService.recordNow({
      event: 'login',
      ip: ADDRESS,
      userId: ana.userId,
      occurredAt: new Date(now.getTime() - 200 * DAY_MS),
    });
    await accessRecordService.recordNow({
      event: 'login',
      ip: ADDRESS,
      userId: ana.userId,
      occurredAt: new Date(now.getTime() - 10 * DAY_MS),
    });

    expect(await accessRecordService.pruneExpired(now, 183)).toBe(1);
    expect(await accessRecordService.pruneExpired(now, 183)).toBe(0);
    expect(await db.select().from(accessRecords)).toHaveLength(1);
  });
});

describe('the search', () => {
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR_MS);

  beforeEach(async () => {
    await accessRecordService.recordNow({
      event: 'login',
      ip: ADDRESS,
      userId: ana.userId,
      occurredAt: at(3),
    });
    await accessRecordService.recordNow({
      event: 'login_failed',
      ip: '198.51.100.7',
      username: 'bia',
      occurredAt: at(2),
    });
    await accessRecordService.recordNow({
      event: 'register',
      ip: ADDRESS,
      userId: ana.userId,
      occurredAt: at(1),
    });
    await accessRecordService.recordNow({
      event: 'login_failed',
      ip: '198.51.100.8',
      username: 'fantasma',
      occurredAt: at(0.5),
    });
  });

  it('answers newest first, with the account name and the name tried', async () => {
    const page = await accessRecordService.search({ limit: 10 });

    expect(page.items.map((row) => row.event)).toEqual([
      'login_failed',
      'register',
      'login_failed',
      'login',
    ]);
    expect(page.items[0]).toMatchObject({
      username: null,
      usernameTried: 'fantasma',
      userId: null,
    });
    expect(page.items[1]).toMatchObject({ username: 'ana', userId: ana.userId });
    expect(page.nextCursor).toBeNull();
    expect(page.retentionDays).toBe(183);
  });

  it('filters by account, by address, and by time', async () => {
    const byAccount = await accessRecordService.search({ userId: ana.userId, limit: 10 });
    expect(byAccount.items.map((row) => row.event)).toEqual(['register', 'login']);

    // A name that is an account is the account's record, not a name tried.
    const byAddress = await accessRecordService.search({ ip: '198.51.100.7', limit: 10 });
    expect(byAddress.items.map((row) => row.userId)).toEqual([bia.userId]);

    const since = await accessRecordService.search({
      from: at(1.5),
      to: at(0.8),
      limit: 10,
    });
    expect(since.items.map((row) => row.event)).toEqual(['register']);
  });

  it('finds a name that matched nobody by the account search, as well as the account itself', async () => {
    const byName = await accessRecordService.search({ username: 'fantasma', limit: 10 });
    expect(byName.items.map((row) => row.usernameTried)).toEqual(['fantasma']);

    const byAccount = await accessRecordService.search({ username: 'ana', limit: 10 });
    expect(byAccount.items.map((row) => row.event)).toEqual(['register', 'login']);
  });

  it('pages with a cursor, so each record comes once and the last page says so', async () => {
    const first = await accessRecordService.search({ limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();

    const second = await accessRecordService.search({ limit: 3, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((row) => row.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('exports the filters as CSV, a formula typed as a name shown as text, and says when it was cut short', async () => {
    await accessRecordService.recordNow({
      event: 'login_failed',
      ip: ADDRESS,
      username: '=cmd|calc',
      occurredAt: at(0.1),
    });

    const exported = await accessRecordService.exportCsv({ limit: 10 });

    const lines = exported.csv.trim().split('\r\n');
    expect(lines[0]).toBe('time,event,account,account_id,username_tried,ip');
    expect(lines).toHaveLength(6);
    expect(lines[1]).toContain("'=cmd|calc");
    expect(exported.truncated).toBe(false);
  });
});

describe('the administrators read them', () => {
  beforeEach(async () => {
    await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: 'ana', password: PASSWORD } }),
    );
    await from(ADDRESS, () =>
      request('POST', '/auth/login', { body: { username: 'ninguem', password: 'whatever1' } }),
    );
    await recordsOf(2);
    await settle();
  });

  it('refuses everybody who is not an administrator, and anybody who is not signed in', async () => {
    expect((await request('GET', '/admin/api/access-records')).status).toBe(401);
    expect((await request('GET', '/admin/api/access-records', { token: ana.token })).status).toBe(
      403,
    );
    expect(
      (await request('GET', '/admin/api/access-records/export', { token: ana.token })).status,
    ).toBe(403);
  });

  it('lists the records with the retention, and filters them', async () => {
    const { status, data } = await search({});
    expect(status).toBe(200);
    expect(data.retentionDays).toBe(183);
    expect(data.items).toHaveLength(2);

    const anaOnly = await search({ username: 'ana' });
    expect(anaOnly.data.items.map((row: { username: string | null }) => row.username)).toEqual([
      'ana',
    ]);
    const byAddress = await search({ ip: ADDRESS });
    expect(byAddress.data.items).toHaveLength(2);
    expect((await search({ ip: '192.0.2.1' })).data.items).toHaveLength(0);
  });

  it('pages, and refuses a cursor it did not give', async () => {
    const first = await search({ limit: 1 });
    expect(first.data.items).toHaveLength(1);
    expect(first.data.nextCursor).toBeTruthy();

    const second = await search({ limit: 1, cursor: first.data.nextCursor });
    expect(second.data.items[0].id).not.toBe(first.data.items[0].id);
    expect((await search({ cursor: 'nao-e-cursor' })).status).toBe(400);
  });

  it('exports the same filters as CSV, and says whether the export was cut short', async () => {
    const response = await request('GET', '/admin/api/access-records/export', {
      token: admin.token,
      query: { username: 'ana' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toMatch(
      /attachment; filename="keres-access-records-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    expect(response.headers.get('x-export-truncated')).toBe('false');
    const lines = (response.data as string).trim().split('\r\n');
    expect(lines[0]).toBe('time,event,account,account_id,username_tried,ip');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(ADDRESS);
  });

  it('puts the reading on the activity record with the filters used, never the results or the address', async () => {
    await search({ userId: ana.userId, ip: ADDRESS });
    await request('GET', '/admin/api/access-records/export', {
      token: admin.token,
      query: { from: '2026-01-01' },
    });

    const [viewed] = await activityOf('admin.access_records_viewed');
    const [exported] = await activityOf('admin.access_records_exported');
    expect(viewed).toMatchObject({
      category: 'admin',
      actorUserId: admin.userId,
      meta: { status: 200, filters: { userId: ana.userId } },
    });
    expect(exported.meta).toMatchObject({ filters: { from: '2026-01-01' } });
    const everything = JSON.stringify(await db.select().from(auditEvents));
    expect(everything).not.toContain(ADDRESS);
    expect(everything).not.toContain('"ip"');
  });
});
