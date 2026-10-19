import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { auditEvents, messageLog, stories, tiers, users } from '@/db/schema';
import { auditService } from '@/services/compliance/AuditService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '@test/helpers/app';
import { promoteToAdmin, truncateAll } from '@test/helpers/database';

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;

/** The record is written after the response, without anybody waiting: wait for it to be there. */
async function eventsOf(action: string, expected = 1) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.action, action));
    if (rows.length >= expected) return rows;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return db.select().from(auditEvents).where(eq(auditEvents.action, action));
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
const allEvents = () => db.select().from(auditEvents);
const activity = (query: Record<string, string | number> = {}) =>
  request('GET', '/admin/api/activity', { token: admin.token, query });

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  await settle();
  await db.delete(auditEvents);
});

describe('what the server records by itself', () => {
  it('records a login that failed, by the name tried and the account behind it, never the password', async () => {
    const wrong = await request('POST', '/auth/login', {
      body: { username: 'ana', password: 'not-the-password' },
    });
    expect(wrong.status).toBe(401);

    const [event] = await eventsOf('auth.login');
    expect(event).toMatchObject({
      category: 'auth',
      outcome: 'failure',
      actorUserId: ana.userId,
      actorUsername: 'ana',
    });
    expect(event.meta).toMatchObject({ status: 401 });
    expect(JSON.stringify(event)).not.toContain('not-the-password');
  });

  it('records a login with a name nobody has, with no account behind it', async () => {
    await request('POST', '/auth/login', { body: { username: 'ghost', password: 'whatever1' } });

    const [event] = await eventsOf('auth.login');
    expect(event).toMatchObject({ actorUserId: null, actorUsername: 'ghost', outcome: 'failure' });
  });

  it('records a login that worked, and a new account', async () => {
    await request('POST', '/auth/login', {
      body: { username: 'ana', password: 'senha-de-teste-123' },
    });
    await request('POST', '/auth/register', {
      body: { username: 'caio', password: 'caiopassword1' },
    });

    const [login] = await eventsOf('auth.login');
    const [registered] = await eventsOf('auth.register');
    expect(login).toMatchObject({ outcome: 'success', actorUserId: ana.userId });
    expect(registered).toMatchObject({ outcome: 'success', actorUsername: 'caio' });
    expect(registered.actorUserId).toBeTruthy();
  });

  it('records friendship changes with the person they were done to', async () => {
    await befriend(ana, bia);

    const [sent] = await eventsOf('friend.request_sent');
    const [accepted] = await eventsOf('friend.request_accepted');
    expect(sent).toMatchObject({
      category: 'friendship',
      actorUserId: ana.userId,
      subjectUserId: bia.userId,
      outcome: 'success',
    });
    expect(accepted).toMatchObject({ actorUserId: bia.userId, subjectUserId: ana.userId });
  });

  it('records that a message was sent and to whom, and never what it says', async () => {
    await befriend(ana, bia);
    await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'a very private secret sentence' },
    });
    await request('POST', '/messages/admin', {
      token: ana.token,
      body: { body: 'another confidential text' },
    });

    const [direct] = await eventsOf('message.sent_direct');
    const [toAdmins] = await eventsOf('message.sent_admin');
    expect(direct).toMatchObject({ actorUserId: ana.userId, subjectUserId: bia.userId });
    expect(toAdmins).toMatchObject({ actorUserId: ana.userId, subjectUserId: null });
    const everything = JSON.stringify(await allEvents());
    expect(everything).not.toContain('private secret');
    expect(everything).not.toContain('confidential');
  });

  it('records a refusal with the reason it gave', async () => {
    await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'hello' },
    });

    const [event] = await eventsOf('message.sent_direct');
    expect(event).toMatchObject({ outcome: 'denied' });
    expect(event.meta).toMatchObject({ status: 403, reason: expect.stringMatching(/friends/) });
  });

  it('records a plan limit being met as that, apart from rate limiting', async () => {
    await befriend(ana, bia);
    const tierId = newId();
    await db.insert(tiers).values({ id: tierId, name: 'Quiet', maxMessagesPerDay: 0 });
    await db.update(users).set({ tierId }).where(eq(users.id, ana.userId));
    await db.delete(auditEvents);

    const refused = await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'hello' },
    });
    expect(refused.status).toBe(429);

    const [event] = await eventsOf('limits.exceeded');
    expect(event).toMatchObject({ category: 'limits', outcome: 'denied', actorUserId: ana.userId });
    expect(event.meta).toMatchObject({ route: 'message.sent_direct' });
    expect(await eventsOf('security.rate_limited', 0)).toHaveLength(0);
  });

  it("records somebody refused at the administrators' door", async () => {
    await request('GET', '/admin/api/users', { token: ana.token });
    await request('GET', '/admin/api/users');

    const denied = await eventsOf('security.admin_access_denied', 2);
    expect(denied).toHaveLength(2);
    expect(denied.map((event) => event.actorUserId).sort()).toEqual([ana.userId, null].sort());
    expect(denied.every((event) => event.outcome === 'denied')).toBe(true);
  });

  it('records what an administrator changes, by who', async () => {
    await request('POST', '/admin/api/tiers', { token: admin.token, body: { name: 'Pro' } });
    await request('PUT', `/admin/api/users/${ana.userId}`, {
      token: admin.token,
      body: { bio: 'hello' },
    });

    const [created] = await eventsOf('admin.tier_created');
    const [updated] = await eventsOf('admin.user_updated');
    expect(created).toMatchObject({
      category: 'admin',
      actorUserId: admin.userId,
      outcome: 'success',
    });
    expect(updated).toMatchObject({
      actorUserId: admin.userId,
      subjectUserId: ana.userId,
      targetType: 'user',
      targetId: ana.userId,
    });
  });

  it("records an administrator opening a user's message, which is reading private data", async () => {
    await request('POST', '/messages/admin', { token: ana.token, body: { body: 'help' } });
    const [row] = (await activityMessages()).items;

    await request('GET', `/admin/api/messages/${row.id}`, { token: admin.token });

    const [opened] = await eventsOf('admin.message_opened');
    expect(opened).toMatchObject({
      actorUserId: admin.userId,
      targetType: 'message',
      targetId: row.id,
    });
  });

  it('records a refused sync only once for a story while it keeps coming', async () => {
    for (let i = 0; i < 3; i++) {
      auditService.recordThrottled('sync-limit:u:s', 60_000, {
        category: 'limits',
        action: 'limits.exceeded',
        outcome: 'denied',
      });
    }

    expect(await eventsOf('limits.exceeded')).toHaveLength(1);
  });

  it('never fails the request it describes when the record cannot be written', async () => {
    // A category outside the list makes the insert fail on Postgres' enum-like check only where there is one;
    // here the point is the contract: `record` returns at once and never throws.
    expect(() =>
      auditService.record({
        category: 'system',
        action: 'system.test',
        meta: { circular: 1n as never },
      }),
    ).not.toThrow();
  });
});

async function activityMessages() {
  return (await request('GET', '/admin/api/messages', { token: admin.token })).data;
}

describe('the activity list of the admin panel', () => {
  beforeEach(async () => {
    await befriend(ana, bia);
    await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'hi' },
    });
    await request('POST', '/auth/login', { body: { username: 'bia', password: 'wrong-password' } });
    await request('POST', '/admin/api/tiers', { token: admin.token, body: { name: 'Pro' } });
    await eventsOf('admin.tier_created');
    await eventsOf('message.sent_direct');
    await eventsOf('auth.login');
    await eventsOf('friend.request_accepted');
  });

  it('lists newest first, with who and whom as people', async () => {
    const { status, data } = await activity();

    expect(status).toBe(200);
    expect(data.total).toBeGreaterThanOrEqual(5);
    const times = data.items.map((event: { createdAt: string }) => event.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
    const sent = data.items.find(
      (event: { action: string }) => event.action === 'message.sent_direct',
    );
    expect(sent.actor).toMatchObject({ id: ana.userId, username: 'ana', isDeleted: false });
    expect(sent.actor.tag).toBeTruthy();
    expect(sent.subject).toMatchObject({ id: bia.userId, username: 'bia' });
  });

  it('can be read oldest first', async () => {
    const { data } = await activity({ order: 'asc' });

    const times = data.items.map((event: { createdAt: string }) => event.createdAt);
    expect([...times].sort()).toEqual(times);
  });

  it('filters by category, outcome and a part of the action', async () => {
    const byCategory = await activity({ category: 'friendship' });
    expect(
      byCategory.data.items.every((e: { category: string }) => e.category === 'friendship'),
    ).toBe(true);
    expect(byCategory.data.total).toBe(2);

    const failures = await activity({ outcome: 'failure' });
    expect(failures.data.items.map((e: { action: string }) => e.action)).toEqual(['auth.login']);

    const byAction = await activity({ action: 'tier_' });
    expect(byAction.data.items.map((e: { action: string }) => e.action)).toEqual([
      'admin.tier_created',
    ]);
  });

  it('follows a person: what they did and what was done to them', async () => {
    const { data } = await activity({ userId: bia.userId });

    const actions = data.items.map((e: { action: string }) => e.action).sort();
    // Bia accepted ana's request, was written to by ana, and failed a login.
    expect(actions).toEqual([
      'auth.login',
      'friend.request_accepted',
      'friend.request_sent',
      'message.sent_direct',
    ]);
  });

  it('searches the action, the names, the tags and the targets', async () => {
    expect((await activity({ search: 'tier_created' })).data.total).toBe(1);
    expect((await activity({ search: 'ana' })).data.total).toBeGreaterThan(0);
    expect((await activity({ search: bia.userId })).data.total).toBeGreaterThan(0);
    expect((await activity({ search: 'nothing-like-this' })).data.total).toBe(0);
  });

  it('filters by time', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60 * 60_000).toISOString();

    expect((await activity({ from: future })).data.total).toBe(0);
    expect((await activity({ to: past })).data.total).toBe(0);
    expect((await activity({ from: past, to: future })).data.total).toBeGreaterThan(0);
  });

  it('pages', async () => {
    const { data } = await activity({ pageSize: 2, page: 2 });

    expect(data).toMatchObject({ page: 2, pageSize: 2 });
    expect(data.items).toHaveLength(2);
  });

  it('refuses a filter outside what it knows', async () => {
    expect((await activity({ category: 'moon' })).status).toBe(400);
    expect((await activity({ pageSize: 500 })).status).toBe(400);
  });

  it('keeps the name of an actor whose account is gone', async () => {
    await db.update(users).set({ isDeleted: true }).where(eq(users.id, ana.userId));

    const { data } = await activity({ action: 'message.sent_direct' });

    expect(data.items[0].actor).toMatchObject({ username: 'ana', isDeleted: true });
  });

  it('stays behind the admin gate', async () => {
    expect((await request('GET', '/admin/api/activity')).status).toBe(401);
    expect((await request('GET', '/admin/api/activity', { token: ana.token })).status).toBe(403);
    expect((await request('GET', '/admin/api/activity/summary', { token: ana.token })).status).toBe(
      403,
    );
    expect((await request('GET', '/admin/api/activity/export', { token: ana.token })).status).toBe(
      403,
    );
  });
});

describe('sending a story again after it was unlinked', () => {
  it('does not record the question put to the owner as a failure, only the upload they agreed to', async () => {
    const story = await uploadTestStory(ana.token, 'A Queda');
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, {
      token: ana.token,
    });
    await db.update(stories).set({ isDeleted: true }).where(eq(stories.id, story.id));
    await eventsOf('story.imported');
    const before = (await allEvents()).filter((event) => event.action === 'story.imported').length;

    const asked = await request('POST', '/stories/import', {
      token: ana.token,
      body: exported,
      query: { storyId: story.id },
    });
    await settle();
    expect(asked.status).toBe(409);
    expect(asked.data.code).toBe('STORY_PREVIOUSLY_ON_SERVER');
    const afterQuestion = (await allEvents()).filter((event) => event.action === 'story.imported');
    expect(afterQuestion).toHaveLength(before);

    const agreed = await request('POST', '/stories/import', {
      token: ana.token,
      body: exported,
      query: { storyId: story.id, replaceUnlinked: 'true' },
    });
    expect(agreed.status).toBe(200);
    await eventsOf('story.imported', before + 1);
    const imports = (await allEvents()).filter((event) => event.action === 'story.imported');
    expect(imports.at(-1)?.outcome).toBe('success');
  });
});

describe('the summary', () => {
  it('counts the last hours and says how the server is doing', async () => {
    await befriend(ana, bia);
    await request('POST', '/auth/login', { body: { username: 'ana', password: 'wrong1' } });
    await request('POST', '/auth/login', { body: { username: 'ana', password: 'wrong2' } });
    await request('POST', '/auth/register', {
      body: { username: 'caio', password: 'caiopassword1' },
    });
    await request('POST', '/messages/admin', { token: ana.token, body: { body: 'hello' } });
    await request('GET', '/admin/api/users', { token: ana.token });
    await eventsOf('security.admin_access_denied');
    await eventsOf('message.sent_admin');
    await eventsOf('auth.register');
    await eventsOf('auth.login', 2);

    const { status, data } = await request('GET', '/admin/api/activity/summary', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({
      hours: 24,
      failedLogins: 2,
      newAccounts: 1,
      messages: 1,
      denied: 1,
    });
    // No addresses in the activity summary: they are on the access records, not here.
    expect(data).not.toHaveProperty('topFailedLoginIps');
    expect(data.byCategory.auth).toBeGreaterThanOrEqual(3);
    expect(data.byCategory.security).toBe(1);
    expect(data.perDay).toHaveLength(14);
    expect(data.perDay.at(-1).count).toBeGreaterThan(0);
    expect(data.system).toMatchObject({
      databaseDriver: expect.stringMatching(/postgres|sqlite/),
      retentionDays: 365,
      users: { total: 4, active: 4, deleted: 0, admins: 1 },
    });
    expect(data.system.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(data.system.version).toMatch(/\d+\.\d+/);
  });

  it('counts what the administrators did, a plan created by name', async () => {
    await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Plano de teste' },
    });
    await eventsOf('admin.tier_created');

    const { data } = await request('GET', '/admin/api/activity/summary', { token: admin.token });

    expect(data.adminActions).toBe(1);
    expect(data.byCategory.admin).toBe(1);
  });

  it('looks at the window it is asked for', async () => {
    await request('POST', '/auth/login', { body: { username: 'ana', password: 'wrong1' } });
    await eventsOf('auth.login');
    await db
      .update(auditEvents)
      .set({ createdAt: new Date(Date.now() - 3 * 60 * 60_000) })
      .where(eq(auditEvents.action, 'auth.login'));

    const lastHour = await request('GET', '/admin/api/activity/summary', {
      token: admin.token,
      query: { hours: 1 },
    });
    const lastDay = await request('GET', '/admin/api/activity/summary', { token: admin.token });

    expect(lastHour.data.failedLogins).toBe(0);
    expect(lastDay.data.failedLogins).toBe(1);
    expect(
      (
        await request('GET', '/admin/api/activity/summary', {
          token: admin.token,
          query: { hours: 0 },
        })
      ).status,
    ).toBe(400);
  });
});

describe('the export', () => {
  it('is the filtered record as a CSV file, with the export itself on the record', async () => {
    await request('POST', '/auth/login', { body: { username: '=cmd|calc', password: 'x' } });
    await eventsOf('auth.login');

    const response = await request('GET', '/admin/api/activity/export', {
      token: admin.token,
      query: { category: 'auth' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toMatch(
      /attachment; filename="keres-activity-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const lines = (response.data as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'time,category,action,outcome,actor,actor_id,subject,subject_id,target_type,target_id,meta',
    );
    expect(lines).toHaveLength(2);
    // What was typed as a name is text in a spreadsheet, not a formula.
    expect(lines[1]).toContain("'=cmd|calc");
    const [exported] = await eventsOf('admin.activity_exported');
    expect(exported).toMatchObject({ actorUserId: admin.userId, category: 'admin' });
  });
});

describe('the retention', () => {
  it('drops what is older than the days it keeps, and nothing else', async () => {
    const now = new Date();
    await auditService.recordNow({ category: 'system', action: 'system.fresh' });
    await auditService.recordNow({ category: 'system', action: 'system.old' });
    await db
      .update(auditEvents)
      .set({ createdAt: new Date(now.getTime() - 400 * 24 * 60 * 60_000) })
      .where(eq(auditEvents.action, 'system.old'));

    const removed = await auditService.prune(now, 365);

    expect(removed).toBe(1);
    expect((await allEvents()).map((event) => event.action)).toEqual(['system.fresh']);
  });
});

describe('what the record never holds', () => {
  it('has no address and no user agent in its columns, and none of them in what it writes', async () => {
    // Every sign-in is on the access record, with its address; the activity record keeps only the who and what.
    await request('POST', '/auth/login', { body: { username: 'ana', password: 'wrong-one-1' } });
    await request('GET', '/admin/api/users', { token: ana.token });
    await eventsOf('auth.login');
    await settle();

    const columns = Object.keys((await allEvents())[0] ?? {});
    expect(columns).not.toContain('ip');
    expect(columns).not.toContain('userAgent');
    const { data } = await request('GET', '/admin/api/activity', { token: admin.token });
    expect(JSON.stringify(data)).not.toMatch(/"ip"|"userAgent"|"user_agent"/);
  });

  it('has no password, token or text of a message anywhere, whatever was done', async () => {
    await befriend(ana, bia);
    await request('POST', '/auth/login', { body: { username: 'ana', password: 'SuperSecretPw9' } });
    await request('PUT', '/user/password', {
      token: ana.token,
      body: { currentPassword: 'senha-de-teste-123', newPassword: 'BrandNewSecret77' },
    });
    await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'PrivateWords123' },
    });
    await settle();
    await db.insert(messageLog).values({ id: newId(), userId: ana.userId, kind: 'direct' });

    const everything = JSON.stringify(await allEvents());

    for (const secret of [
      'SuperSecretPw9',
      'BrandNewSecret77',
      'PrivateWords123',
      'senha-de-teste-123',
      ana.token,
    ]) {
      expect(everything).not.toContain(secret);
    }
  });
});
