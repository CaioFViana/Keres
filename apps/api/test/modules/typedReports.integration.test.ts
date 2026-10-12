import { ulid } from 'ulid';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { db } from '../../src/db';
import { storyPublications, storyShowcaseEntries } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let storyId: string;

async function reportInbox(): Promise<{ body: string }[]> {
  const { status, data } = await request('GET', '/admin/api/messages', {
    token: admin.token,
    query: { source: 'report' },
  });
  expect(status).toBe(200);
  return data.items;
}

async function befriend() {
  await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
  await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });
}

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
});

describe('typed story reports', () => {
  it('carries the type in the envelope the inbox filters on', async () => {
    const { status } = await request('POST', `/stories/${storyId}/report`, {
      token: bia.token,
      body: { type: 'intimate', reason: 'please remove this' },
    });
    expect(status).toBe(201);

    const items = await reportInbox();
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(`[REPORT type:intimate story:${storyId}] please remove this`);
  });

  it('defaults older reason-only clients to an untyped report', async () => {
    const { status } = await request('POST', `/stories/${storyId}/report`, {
      token: bia.token,
      body: { reason: 'spam links everywhere' },
    });
    expect(status).toBe(201);

    const items = await reportInbox();
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(`[REPORT type:other story:${storyId}] spam links everywhere`);
  });

  it('narrows the admin inbox to one report type', async () => {
    await request('POST', `/stories/${storyId}/report`, {
      token: bia.token,
      body: { type: 'intimate', reason: 'please remove this' },
    });
    await request('POST', `/stories/${storyId}/report`, {
      token: bia.token,
      body: { type: 'spam_abuse', reason: 'spam links' },
    });

    const { status, data } = await request('GET', '/admin/api/messages', {
      token: admin.token,
      query: { source: 'report', reportType: 'intimate' },
    });
    expect(status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.items[0].body).toBe(`[REPORT type:intimate story:${storyId}] please remove this`);
  });
});

describe('POST /user/:userId/report', () => {
  it('reports another account with a type', async () => {
    const { status } = await request('POST', `/user/${bia.userId}/report`, {
      token: ana.token,
      body: { type: 'spam_abuse', reason: 'bots in every story' },
    });
    expect(status).toBe(201);

    const items = await reportInbox();
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(`[REPORT type:spam_abuse user:${bia.userId}] bots in every story`);
  });

  it('refuses self-reports, strangers without session, and unknown accounts', async () => {
    expect(
      (
        await request('POST', `/user/${ana.userId}/report`, {
          token: ana.token,
          body: { reason: 'x' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await request('POST', `/user/${bia.userId}/report`, { body: { reason: 'x' } })).status,
    ).toBe(401);
    expect(
      (
        await request('POST', `/user/${newId()}/report`, {
          token: ana.token,
          body: { reason: 'x' },
        })
      ).status,
    ).toBe(404);
  });
});

describe('POST /messages/:messageId/report', () => {
  it('reports a message the reporter is a side of', async () => {
    await befriend();
    const sent = await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'olá' },
    });
    expect(sent.status).toBe(201);

    const { status } = await request('POST', `/messages/${sent.data.id}/report`, {
      token: bia.token,
      body: { type: 'illegal', reason: 'threats' },
    });
    expect(status).toBe(201);

    const items = await reportInbox();
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(`[REPORT type:illegal message:${sent.data.id}] threats`);
  });

  it('answers 404 for other conversations and unknown messages', async () => {
    await befriend();
    const sent = await request('POST', `/messages/user/${bia.userId}`, {
      token: ana.token,
      body: { body: 'olá' },
    });
    const cid = await registerUser('cid');

    // A stranger to the conversation learns nothing, not even whether it exists.
    expect(
      (
        await request('POST', `/messages/${sent.data.id}/report`, {
          token: cid.token,
          body: { reason: 'x' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request('POST', `/messages/${newId()}/report`, {
          token: ana.token,
          body: { reason: 'x' },
        })
      ).status,
    ).toBe(404);
    expect(await reportInbox()).toHaveLength(0);
  });
});

describe('POST /stories/:storyId/publications/:publicationId/report', () => {
  async function seedPublication(): Promise<string> {
    const publicationId = ulid();
    await db.insert(storyShowcaseEntries).values({
      storyId,
      ownerUserId: ana.userId,
      visibility: 'public',
    });
    await db.insert(storyPublications).values({
      id: publicationId,
      storyId,
      ownerUserId: ana.userId,
      label: 'v1',
      operationVersion: 0,
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
      byteSize: 10,
      mediaIncluded: 0,
      mediaTotal: 0,
      snapshot: {
        title: 'A Queda',
        description: null,
        genre: null,
        language: null,
        author: null,
        type: 'linear',
        theme: null,
      },
    });
    return publicationId;
  }

  it('reports a published version with a type', async () => {
    const publicationId = await seedPublication();

    const { status } = await request(
      'POST',
      `/stories/${storyId}/publications/${publicationId}/report`,
      { token: bia.token, body: { type: 'copyright', reason: 'my chapter, word for word' } },
    );
    expect(status).toBe(201);

    const items = await reportInbox();
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe(
      `[REPORT type:copyright publication:${publicationId}] my chapter, word for word`,
    );
  });

  it('answers 404 for versions that were never published', async () => {
    const { status } = await request('POST', `/stories/${storyId}/publications/${newId()}/report`, {
      token: bia.token,
      body: { reason: 'x' },
    });
    expect(status).toBe(404);
  });
});
