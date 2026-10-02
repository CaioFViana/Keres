import { ADMIN_MESSAGES_PER_DAY } from '@keres/shared/metadata/MessageLimits';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import * as webSocket from '../../src/modules/webSocket/webSocket.route';
import { messageLog, messages, tiers, users } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, softDeleteUser, truncateAll } from '../helpers/database';

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let caio: TestUser;

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

const writeTo = (from: TestUser, to: TestUser, body = 'Hello') =>
  request('POST', `/messages/user/${to.userId}`, { token: from.token, body: { body } });
const writeToAdmins = (from: TestUser, body = 'Help') =>
  request('POST', '/messages/admin', { token: from.token, body: { body } });
const conversation = (who: TestUser, peer: TestUser) =>
  request('GET', `/messages/user/${peer.userId}`, { token: who.token });
const adminList = (query: Record<string, string | number> = {}) =>
  request('GET', '/admin/api/messages', { token: admin.token, query });

async function assignTier(user: TestUser, maxMessagesPerDay: number | null) {
  const id = newId();
  await db.insert(tiers).values({ id, name: `tier-${id}`, maxMessagesPerDay });
  await db.update(users).set({ tierId: id }).where(eq(users.id, user.userId));
}

/** A visitor message, straight into the table: the contact form has a per-IP budget of its own. */
async function storeSiteMessage(subject: string, createdAt = new Date()) {
  const id = newId();
  await db.insert(messages).values({
    id,
    channel: 'site',
    subject,
    body: 'From the site',
    contactEmail: 'visitor@example.com',
    senderDeletedAt: new Date(),
    createdAt,
  });
  return id;
}

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  caio = await registerUser('caio');
});

describe('messages between friends', () => {
  it('refuses to write to somebody who is not a friend', async () => {
    const { status, data } = await writeTo(ana, bia);

    expect(status).toBe(403);
    expect(data.message).toMatch(/friends/);
    expect(await db.select().from(messages)).toHaveLength(0);
  });

  it("delivers between friends, each side seeing it as theirs or the other's", async () => {
    await befriend(ana, bia);

    const sent = await writeTo(ana, bia, 'Hi Bia');
    expect(sent.status).toBe(201);
    expect(sent.data).toMatchObject({ body: 'Hi Bia', mine: true });
    await writeTo(bia, ana, 'Hi Ana');

    const forAna = await conversation(ana, bia);
    expect(forAna.status).toBe(200);
    expect(forAna.data.items.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual(
      [
        ['Hi Ana', false],
        ['Hi Bia', true],
      ],
    );
    const forBia = await conversation(bia, ana);
    expect(forBia.data.items.map((m: { mine: boolean }) => m.mine)).toEqual([true, false]);
  });

  it('pages a conversation newest first with a cursor', async () => {
    await befriend(ana, bia);
    for (const body of ['one', 'two', 'three']) await writeTo(ana, bia, body);

    const first = await request('GET', `/messages/user/${bia.userId}`, {
      token: ana.token,
      query: { limit: 2 },
    });
    expect(first.data.items.map((m: { body: string }) => m.body)).toEqual(['three', 'two']);
    expect(first.data.nextBefore).toBeTruthy();

    const second = await request('GET', `/messages/user/${bia.userId}`, {
      token: ana.token,
      query: { limit: 2, before: first.data.nextBefore },
    });
    expect(second.data.items.map((m: { body: string }) => m.body)).toEqual(['one']);
    expect(second.data.nextBefore).toBeNull();
  });

  it('rejects an empty message, a too long one, and a message to oneself', async () => {
    await befriend(ana, bia);

    expect((await writeTo(ana, bia, '   ')).status).toBe(400);
    expect((await writeTo(ana, bia, 'x'.repeat(2001))).status).toBe(400);
    expect((await writeTo(ana, ana)).status).toBe(400);
  });

  it('refuses a pending request, a block, and a friend who left', async () => {
    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
    expect((await writeTo(ana, bia)).status).toBe(403);

    await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });
    expect((await writeTo(ana, bia)).status).toBe(201);

    await request('DELETE', `/friend/unfriend/${bia.userId}`, { token: ana.token });
    expect((await writeTo(ana, bia)).status).toBe(403);
    // The history is kept but out of sight until the friendship is back.
    expect((await conversation(ana, bia)).status).toBe(403);

    await befriend(ana, bia);
    expect((await conversation(ana, bia)).data.items).toHaveLength(1);

    await request('POST', `/friend/blacklist/${ana.userId}`, { token: bia.token });
    expect((await writeTo(ana, bia)).status).toBe(403);
  });

  it('answers 404 for a user who no longer has an account', async () => {
    await befriend(ana, bia);
    await softDeleteUser(bia.userId);

    expect((await writeTo(ana, bia)).status).toBe(404);
  });

  it('requires a signed-in user', async () => {
    expect((await request('GET', '/messages/conversations')).status).toBe(401);
    expect((await request('POST', '/messages/admin', { body: { body: 'x' } })).status).toBe(401);
  });
});

describe('the inbox', () => {
  it('lists one line per conversation, newest first, friends only', async () => {
    await befriend(ana, bia);
    await befriend(ana, caio);
    await writeTo(ana, bia, 'to bia');
    await writeTo(caio, ana, 'from caio');
    await writeToAdmins(ana, 'to the admins');

    const { status, data } = await request('GET', '/messages/conversations', { token: ana.token });

    expect(status).toBe(200);
    expect(
      data.map(
        (c: {
          kind: string;
          peerUserId: string | null;
          lastMessage: { body: string; mine: boolean };
        }) => [c.kind, c.peerUserId, c.lastMessage.body, c.lastMessage.mine],
      ),
    ).toEqual([
      ['admin', null, 'to the admins', true],
      ['direct', caio.userId, 'from caio', false],
      ['direct', bia.userId, 'to bia', true],
    ]);

    await request('DELETE', `/friend/unfriend/${caio.userId}`, { token: ana.token });
    const after = await request('GET', '/messages/conversations', { token: ana.token });
    expect(after.data.map((c: { peerUserId: string | null }) => c.peerUserId)).toEqual([
      null,
      bia.userId,
    ]);
  });

  it('is empty for somebody with no messages', async () => {
    const { data } = await request('GET', '/messages/conversations', { token: caio.token });

    expect(data).toEqual([]);
  });
});

describe('deleting for oneself', () => {
  it('hides a message from one side only, and drops it when both are gone', async () => {
    await befriend(ana, bia);
    const { data: sent } = await writeTo(ana, bia, 'secret');

    const mine = await request('DELETE', `/messages/${sent.id}`, { token: ana.token });
    expect(mine.status).toBe(200);
    expect((await conversation(ana, bia)).data.items).toHaveLength(0);
    expect((await conversation(bia, ana)).data.items).toHaveLength(1);
    expect(await db.select().from(messages)).toHaveLength(1);

    await request('DELETE', `/messages/${sent.id}`, { token: bia.token });
    expect(await db.select().from(messages)).toHaveLength(0);
  });

  it('refuses to delete a message of two other people', async () => {
    await befriend(ana, bia);
    const { data: sent } = await writeTo(ana, bia);

    expect((await request('DELETE', `/messages/${sent.id}`, { token: caio.token })).status).toBe(
      404,
    );
  });

  it('clears a whole conversation from one side', async () => {
    await befriend(ana, bia);
    await writeTo(ana, bia, 'one');
    await writeTo(bia, ana, 'two');

    const cleared = await request('DELETE', `/messages/user/${bia.userId}`, { token: ana.token });

    expect(cleared.status).toBe(200);
    expect((await conversation(ana, bia)).data.items).toHaveLength(0);
    expect((await conversation(bia, ana)).data.items).toHaveLength(2);
  });
});

describe('daily limits', () => {
  it('stops messages to users at the ceiling of the plan', async () => {
    await befriend(ana, bia);
    await assignTier(ana, 2);

    expect((await writeTo(ana, bia)).status).toBe(201);
    expect((await writeTo(ana, bia)).status).toBe(201);
    const refused = await writeTo(ana, bia);

    expect(refused.status).toBe(429);
    expect(refused.data.message).toMatch(/limit/i);
  });

  it('does not let deleting messages hand the allowance back', async () => {
    await befriend(ana, bia);
    await assignTier(ana, 1);
    const { data: sent } = await writeTo(ana, bia);
    await request('DELETE', `/messages/user/${bia.userId}`, { token: ana.token });
    await request('DELETE', `/messages/${sent.id}`, { token: bia.token });

    expect((await writeTo(ana, bia)).status).toBe(429);
  });

  it('treats 0 as silenced and null as unlimited', async () => {
    await befriend(ana, bia);
    await assignTier(ana, 0);
    expect((await writeTo(ana, bia)).status).toBe(429);

    await assignTier(ana, null);
    for (let i = 0; i < 5; i++) expect((await writeTo(ana, bia)).status).toBe(201);
  });

  it('counts only the last 24 hours', async () => {
    await befriend(ana, bia);
    await assignTier(ana, 1);
    await db.insert(messageLog).values({
      id: newId(),
      userId: ana.userId,
      kind: 'direct',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    expect((await writeTo(ana, bia)).status).toBe(201);
  });

  it('gives the administrators one fixed ceiling, whatever the plan', async () => {
    await assignTier(ana, 0);
    for (let i = 0; i < ADMIN_MESSAGES_PER_DAY; i++) {
      await db.insert(messageLog).values({ id: newId(), userId: ana.userId, kind: 'admin' });
    }

    expect((await writeToAdmins(ana)).status).toBe(429);
    // Another user is not affected.
    expect((await writeToAdmins(bia)).status).toBe(201);
  });

  it('reports what is left today', async () => {
    await befriend(ana, bia);
    await assignTier(ana, 5);
    await writeTo(ana, bia);
    await writeToAdmins(ana);

    const { status, data } = await request('GET', '/messages/limits', { token: ana.token });

    expect(status).toBe(200);
    expect(data).toEqual({
      direct: { limit: 5, used: 1 },
      admin: { limit: ADMIN_MESSAGES_PER_DAY, used: 1 },
    });
  });
});

describe('writing to the administrators', () => {
  it('shows up in the admin inbox with who wrote it', async () => {
    const sent = await writeToAdmins(ana, 'I need help');
    expect(sent.status).toBe(201);

    const { status, data } = await adminList();

    expect(status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.items[0]).toMatchObject({
      channel: 'admin',
      fromAdmin: false,
      body: 'I need help',
      isRead: false,
      isArchived: false,
      user: { id: ana.userId, username: 'ana', isDeleted: false },
    });
    expect(data.items[0].user.tag).toBeTruthy();
  });

  it('tells nothing about being read to the user', async () => {
    await writeToAdmins(ana);
    const [row] = (await adminList()).data.items;
    await request('GET', `/admin/api/messages/${row.id}`, { token: admin.token });

    const { data } = await request('GET', '/messages/admin', { token: ana.token });

    expect(Object.keys(data.items[0]).sort()).toEqual(['body', 'createdAt', 'id', 'mine']);
  });

  it('refuses a soft-deleted account', async () => {
    await softDeleteUser(ana.userId);

    expect((await writeToAdmins(ana)).status).toBe(403);
  });
});

describe('the admin inbox', () => {
  it('filters by where the message came from', async () => {
    await storeSiteMessage('Plans');
    await writeToAdmins(ana, 'from a user');

    const all = await adminList();
    const site = await adminList({ source: 'site' });
    const user = await adminList({ source: 'user' });

    expect(all.data.total).toBe(2);
    expect(site.data.items.map((m: { channel: string }) => m.channel)).toEqual(['site']);
    expect(site.data.items[0]).toMatchObject({
      subject: 'Plans',
      contactEmail: 'visitor@example.com',
      user: null,
    });
    expect(user.data.items.map((m: { channel: string }) => m.channel)).toEqual(['admin']);
  });

  it('filters by read state, and opening a message reads it', async () => {
    const siteId = await storeSiteMessage('Plans');
    await writeToAdmins(ana);

    const opened = await request('GET', `/admin/api/messages/${siteId}`, { token: admin.token });
    expect(opened.status).toBe(200);
    expect(opened.data.message).toMatchObject({ id: siteId, isRead: true });
    expect(opened.data.thread).toEqual([]);

    expect((await adminList({ read: 'unread' })).data.total).toBe(1);
    expect((await adminList({ read: 'read' })).data.items.map((m: { id: string }) => m.id)).toEqual(
      [siteId],
    );
    expect(
      (await request('GET', '/admin/api/messages/unread-count', { token: admin.token })).data,
    ).toEqual({ unread: 1 });
  });

  it('archives and restores, hiding archived ones from the default view', async () => {
    const id = await storeSiteMessage('Old');

    const archived = await request('PATCH', `/admin/api/messages/${id}`, {
      token: admin.token,
      body: { archived: true },
    });
    expect(archived.data.isArchived).toBe(true);
    expect((await adminList()).data.total).toBe(0);
    expect((await adminList({ archived: 'archived' })).data.total).toBe(1);
    expect((await adminList({ archived: 'all' })).data.total).toBe(1);
    // An archived message no longer calls for attention.
    expect(
      (await request('GET', '/admin/api/messages/unread-count', { token: admin.token })).data,
    ).toEqual({ unread: 0 });

    const restored = await request('PATCH', `/admin/api/messages/${id}`, {
      token: admin.token,
      body: { archived: false },
    });
    expect(restored.data.isArchived).toBe(false);
    expect((await adminList()).data.total).toBe(1);
  });

  it('marks a message unread again', async () => {
    const id = await storeSiteMessage('Plans');
    await request('GET', `/admin/api/messages/${id}`, { token: admin.token });

    const { data } = await request('PATCH', `/admin/api/messages/${id}`, {
      token: admin.token,
      body: { read: false },
    });

    expect(data.isRead).toBe(false);
  });

  it('rejects an empty change', async () => {
    const id = await storeSiteMessage('Plans');

    const { status } = await request('PATCH', `/admin/api/messages/${id}`, {
      token: admin.token,
      body: {},
    });

    expect(status).toBe(400);
  });

  it('searches the text, the address, the user name and the tag', async () => {
    await storeSiteMessage('Yearly billing');
    await writeToAdmins(ana, 'cannot log in');

    expect((await adminList({ search: 'billing' })).data.total).toBe(1);
    expect((await adminList({ search: 'visitor@' })).data.total).toBe(1);
    expect((await adminList({ search: 'log in' })).data.total).toBe(1);
    expect((await adminList({ search: 'ana' })).data.items[0].user.username).toBe('ana');
    expect((await adminList({ search: 'nothing-like-this' })).data.total).toBe(0);
  });

  it('sorts by date, sender and subject, in both directions', async () => {
    const older = await storeSiteMessage('Bravo', new Date('2025-01-01T00:00:00Z'));
    await storeSiteMessage('Alpha', new Date('2025-06-01T00:00:00Z'));
    await db
      .update(messages)
      .set({ contactEmail: 'zed@example.com' })
      .where(eq(messages.id, older));
    const ids = (r: { data: { items: { subject: string | null }[] } }) =>
      r.data.items.map((m) => m.subject);

    expect(ids(await adminList({ sort: 'date', order: 'asc' }))).toEqual(['Bravo', 'Alpha']);
    expect(ids(await adminList({ sort: 'date', order: 'desc' }))).toEqual(['Alpha', 'Bravo']);
    expect(ids(await adminList({ sort: 'subject', order: 'asc' }))).toEqual(['Alpha', 'Bravo']);
    expect(ids(await adminList({ sort: 'subject', order: 'desc' }))).toEqual(['Bravo', 'Alpha']);
    expect(ids(await adminList({ sort: 'sender', order: 'asc' }))).toEqual(['Alpha', 'Bravo']);
    expect(ids(await adminList({ sort: 'sender', order: 'desc' }))).toEqual(['Bravo', 'Alpha']);
  });

  it('paginates', async () => {
    for (let i = 0; i < 3; i++) await storeSiteMessage(`Message ${i}`);

    const { data } = await adminList({ pageSize: 2, page: 2 });

    expect(data).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(data.items).toHaveLength(1);
  });

  it('rejects an unknown filter value', async () => {
    expect((await adminList({ source: 'moon' })).status).toBe(400);
  });

  it('deletes a message from the site for good', async () => {
    const id = await storeSiteMessage('Plans');

    const deleted = await request('DELETE', `/admin/api/messages/${id}`, { token: admin.token });

    expect(deleted.status).toBe(200);
    expect(await db.select().from(messages)).toHaveLength(0);
    expect((await request('GET', `/admin/api/messages/${id}`, { token: admin.token })).status).toBe(
      404,
    );
    expect(
      (await request('DELETE', `/admin/api/messages/${id}`, { token: admin.token })).status,
    ).toBe(404);
  });

  it("keeps the user's copy when the administrators delete theirs", async () => {
    await writeToAdmins(ana, 'hello');
    const [row] = (await adminList()).data.items;

    await request('DELETE', `/admin/api/messages/${row.id}`, { token: admin.token });

    expect((await adminList()).data.total).toBe(0);
    expect((await request('GET', '/messages/admin', { token: ana.token })).data.items).toHaveLength(
      1,
    );
  });

  it('stays behind the admin gate', async () => {
    expect((await request('GET', '/admin/api/messages')).status).toBe(401);
    expect((await request('GET', '/admin/api/messages', { token: ana.token })).status).toBe(403);
    expect(
      (await request('GET', '/admin/api/messages/unread-count', { token: ana.token })).status,
    ).toBe(403);
  });
});

describe('replying inside the platform', () => {
  it("answers a user, who sees it as the administrators' message", async () => {
    await writeToAdmins(ana, 'I need help');
    const [row] = (await adminList()).data.items;

    const reply = await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: 'We are on it' },
    });

    expect(reply.status).toBe(201);
    expect(reply.data).toMatchObject({
      fromAdmin: true,
      body: 'We are on it',
      user: { id: ana.userId },
    });
    const forAna = await request('GET', '/messages/admin', { token: ana.token });
    expect(forAna.data.items.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual(
      [
        ['We are on it', false],
        ['I need help', true],
      ],
    );
    // Which administrator wrote it is kept for the panel, not sent to the user.
    const stored = await db.query.messages.findFirst({ where: eq(messages.id, reply.data.id) });
    expect(stored?.sentByAdminId).toBe(admin.userId);
    // Replying counts as having read it.
    expect((await adminList({ read: 'unread' })).data.total).toBe(0);
  });

  it('shows the whole conversation with that user when a message is opened', async () => {
    await writeToAdmins(ana, 'first');
    const [row] = (await adminList()).data.items;
    await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: 'answer' },
    });
    await writeToAdmins(ana, 'second');

    const { data } = await request('GET', `/admin/api/messages/${row.id}`, { token: admin.token });

    expect(
      data.thread.map((m: { body: string; fromAdmin: boolean }) => [m.body, m.fromAdmin]),
    ).toEqual([
      ['first', false],
      ['answer', true],
      ['second', false],
    ]);
  });

  it('does not list replies as inbox items', async () => {
    await writeToAdmins(ana, 'first');
    const [row] = (await adminList()).data.items;
    await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: 'answer' },
    });

    expect((await adminList()).data.total).toBe(1);
  });

  it('refuses to reply to a visitor of the site, or to a closed account', async () => {
    const siteId = await storeSiteMessage('Plans');
    const toSite = await request('POST', `/admin/api/messages/${siteId}/reply`, {
      token: admin.token,
      body: { body: 'hi' },
    });
    expect(toSite.status).toBe(409);

    await writeToAdmins(ana);
    const [row] = (await adminList({ source: 'user' })).data.items;
    await softDeleteUser(ana.userId);
    const toClosed = await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: 'hi' },
    });
    expect(toClosed.status).toBe(409);
  });

  it('refuses an empty reply and a reply to a missing message', async () => {
    await writeToAdmins(ana);
    const [row] = (await adminList()).data.items;

    const empty = await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: ' ' },
    });
    const missing = await request('POST', `/admin/api/messages/${newId()}/reply`, {
      token: admin.token,
      body: { body: 'hi' },
    });

    expect(empty.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it('lets the administrators delete their own reply, and the user delete it from theirs', async () => {
    await writeToAdmins(ana, 'help');
    const [row] = (await adminList()).data.items;
    const reply = await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: 'answer' },
    });

    await request('DELETE', `/messages/${reply.data.id}`, { token: ana.token });
    expect((await request('GET', '/messages/admin', { token: ana.token })).data.items).toHaveLength(
      1,
    );
    expect(
      await db.query.messages.findFirst({ where: eq(messages.id, reply.data.id) }),
    ).toBeTruthy();

    await request('DELETE', `/admin/api/messages/${reply.data.id}`, { token: admin.token });
    expect(
      await db.query.messages.findFirst({ where: eq(messages.id, reply.data.id) }),
    ).toBeUndefined();
  });
});

describe('realtime nudges', () => {
  it('tells both sides of a conversation, and only them, when a message is sent', async () => {
    await befriend(ana, bia);
    const emit = vi.spyOn(webSocket, 'emitUserEvent').mockImplementation(() => undefined);

    await writeTo(ana, bia);

    const nudged = emit.mock.calls.map(([userId]) => userId).sort();
    expect(nudged).toEqual([ana.userId, bia.userId].sort());
    expect(emit.mock.calls.every(([, event]) => event.type === 'messages.changed')).toBe(true);
    emit.mockRestore();
  });

  it('tells the user when the administrators answer, and a sender writing to them', async () => {
    const emit = vi.spyOn(webSocket, 'emitUserEvent').mockImplementation(() => undefined);
    await writeToAdmins(ana);
    expect(emit.mock.calls.map(([userId]) => userId)).toEqual([ana.userId]);
    const [row] = (await adminList()).data.items;
    emit.mockClear();

    await request('POST', `/admin/api/messages/${row.id}/reply`, {
      token: admin.token,
      body: { body: 'answer' },
    });

    expect(emit.mock.calls.map(([userId]) => userId)).toEqual([ana.userId]);
    emit.mockRestore();
  });

  it('tells nobody about a refused message', async () => {
    const emit = vi.spyOn(webSocket, 'emitUserEvent').mockImplementation(() => undefined);

    await writeTo(ana, bia);

    expect(emit).not.toHaveBeenCalled();
    emit.mockRestore();
  });
});
