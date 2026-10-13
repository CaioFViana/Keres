import { beforeEach, describe, expect, it } from 'vitest';
import { accessRecordService } from '../../src/services/AccessRecordService';
import { evidenceHoldService } from '../../src/services/EvidenceHoldService';
import { userService } from '../../src/services/UserService';
import { drainBackground } from '../../src/utils/backgroundWork';
import { registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

const DAY = 24 * 60 * 60 * 1000;
let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let storyId: string;

async function report(type: string, reason = 'this is wrong') {
  const { status } = await request('POST', `/stories/${storyId}/report`, {
    token: bia.token,
    body: { type, reason },
  });
  expect(status).toBe(201);
  await drainBackground(5000);
}

async function holds() {
  const { status, data } = await request('GET', '/admin/api/evidence-holds', {
    token: admin.token,
  });
  expect(status).toBe(200);
  return data.items as Array<{
    id: string;
    targetKind: string;
    targetId: string;
    subjectUserId: string | null;
    reportMessageIds: string[];
    createdBy: string | null;
    expiresAt: string;
  }>;
}

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
});

describe('evidence holds made on a report', () => {
  it("keeps a story reported as illegal, with its owner and the owner's sign-in records", async () => {
    await accessRecordService.recordNow({ event: 'login', ip: '203.0.113.7', userId: ana.userId });

    await report('illegal');

    const [hold] = await holds();
    expect(hold).toMatchObject({
      targetKind: 'story',
      targetId: storyId,
      subjectUserId: ana.userId,
      createdBy: null,
    });
    expect(hold.reportMessageIds).toHaveLength(1);
    const { data } = await request('GET', `/admin/api/evidence-holds/${hold.id}`, {
      token: admin.token,
    });
    expect(data.snapshot.item.story.title).toBe('A Queda');
    expect(data.snapshot.subject.account.username).toBe('ana');
    expect(
      data.snapshot.subject.accessRecords.map((record: { ip: string }) => record.ip),
    ).toContain('203.0.113.7');
    const days = (Date.parse(hold.expiresAt) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(182);
  });

  it('does not hold anything for the other report types', async () => {
    await report('spam_abuse');
    await report('other');

    expect(await holds()).toEqual([]);
  });

  it('renews the same hold when the same item is reported again, instead of copying it twice', async () => {
    await report('illegal');
    await report('illegal', 'again');

    const found = await holds();
    expect(found).toHaveLength(1);
    expect(found[0].reportMessageIds).toHaveLength(2);
  });

  it('survives the owner deleting the story and the account being erased', async () => {
    await report('illegal');
    await userService.deleteOwnAccount(ana.userId, ana.password);
    await userService.pruneDeletedAccounts(0, new Date(Date.now() + DAY));

    const [hold] = await holds();
    const { data } = await request('GET', `/admin/api/evidence-holds/${hold.id}`, {
      token: admin.token,
    });
    expect(data.snapshot.item.story.title).toBe('A Queda');
    expect(data.snapshot.subject.account.username).toBe('ana');
  });

  it('holds a reported message, the sender and the text as they were', async () => {
    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
    await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });
    const sent = await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'the text' },
    });
    expect(sent.status).toBeLessThan(300);

    const reported = await request('POST', `/messages/${sent.data.id}/report`, {
      token: bia.token,
      body: { type: 'illegal', reason: 'bad' },
    });
    await drainBackground(5000);

    expect(reported.status).toBe(201);
    const [hold] = await holds();
    expect(hold).toMatchObject({ targetKind: 'message', subjectUserId: ana.userId });
  });
});

describe('administering the holds', () => {
  it('makes a hold by hand for any report, extends it, and lets it go', async () => {
    const created = await request('POST', '/admin/api/evidence-holds', {
      token: admin.token,
      body: { targetKind: 'story', targetId: storyId, note: 'seen in the inbox' },
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ createdBy: admin.userId, note: 'seen in the inbox' });

    const extended = await request('POST', `/admin/api/evidence-holds/${created.data.id}/extend`, {
      token: admin.token,
      body: { days: 400 },
    });
    expect(extended.status).toBe(200);
    expect((Date.parse(extended.data.expiresAt) - Date.now()) / DAY).toBeGreaterThan(399);

    const shorter = await request('POST', `/admin/api/evidence-holds/${created.data.id}/extend`, {
      token: admin.token,
      body: { days: 10 },
    });
    expect((Date.parse(shorter.data.expiresAt) - Date.now()) / DAY).toBeGreaterThan(399);

    const released = await request('DELETE', `/admin/api/evidence-holds/${created.data.id}`, {
      token: admin.token,
    });
    expect(released.status).toBe(200);
    expect(await holds()).toEqual([]);
  });

  it('refuses to anyone who is not an administrator', async () => {
    const { status } = await request('GET', '/admin/api/evidence-holds', { token: ana.token });

    expect(status).toBe(403);
  });

  it('drops the holds past their end and keeps the others', async () => {
    const kept = await evidenceHoldService.createByAdmin(admin.userId, {
      targetKind: 'story',
      targetId: storyId,
    });

    expect(await evidenceHoldService.pruneExpired(new Date(Date.now() + 100 * DAY))).toBe(0);
    expect(await evidenceHoldService.pruneExpired(new Date(Date.now() + 200 * DAY))).toBe(1);
    expect((await holds()).map((hold) => hold.id)).not.toContain(kept.id);
  });
});
