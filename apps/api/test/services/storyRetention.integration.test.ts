import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { operationLog, stories, storyArcs } from '@/db/schema';
import { storyRetentionService } from '@/services/StoryRetentionService';
import { userService } from '@/services/UserService';
import {
  importTestStory,
  registerUser,
  request,
  shareStory,
  type TestUser,
  uploadTestStory,
} from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

const DAY = 24 * 60 * 60 * 1000;
let ana: TestUser;
let bia: TestUser;

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
});

async function markDeleted(storyId: string, daysAgo: number) {
  await db
    .update(stories)
    .set({ isDeleted: true, deletedAt: new Date(Date.now() - daysAgo * DAY) })
    .where(eq(stories.id, storyId));
}

async function story(storyId: string) {
  return db.query.stories.findFirst({ where: eq(stories.id, storyId) });
}

async function arcsOf(storyId: string) {
  return db.query.storyArcs.findMany({ where: eq(storyArcs.storyId, storyId) });
}

describe('stories deleted by their owner', () => {
  it('erases a story deleted more than 30 days ago with everything that belongs to it', async () => {
    const { id } = await uploadTestStory(ana.token, 'Velha');
    await markDeleted(id, 31);
    expect((await arcsOf(id)).length).toBeGreaterThan(0);

    const outcome = await storyRetentionService.purgeExpired();

    expect(outcome).toEqual({ deleted: 1, orphaned: 0, failed: 0 });
    expect(await story(id)).toBeUndefined();
    expect(await arcsOf(id)).toEqual([]);
    expect(await db.query.operationLog.findMany({ where: eq(operationLog.storyId, id) })).toEqual(
      [],
    );
  });

  it('keeps a story deleted less than 30 days ago, so the owner can still restore it', async () => {
    const { id } = await uploadTestStory(ana.token, 'Recente');
    await markDeleted(id, 10);

    const outcome = await storyRetentionService.purgeExpired();

    expect(outcome).toEqual({ deleted: 0, orphaned: 0, failed: 0 });
    expect(await story(id)).toBeDefined();
    expect((await arcsOf(id)).length).toBeGreaterThan(0);
  });

  it('never touches a live story, however old', async () => {
    const { id } = await uploadTestStory(ana.token, 'Viva');
    await db
      .update(stories)
      .set({ updatedAt: new Date(Date.now() - 400 * DAY) })
      .where(eq(stories.id, id));

    await storyRetentionService.purgeExpired();

    expect(await story(id)).toBeDefined();
  });

  it('leaves a collaborator with the same answer a deleted story always gave: 404', async () => {
    const { id } = await uploadTestStory(ana.token, 'Em dupla');
    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
    await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });
    await shareStory(ana, bia, id, 'writer');
    await markDeleted(id, 40);
    await storyRetentionService.purgeExpired();

    const pull = await request('GET', `/sync/${id}/pull`, {
      token: bia.token,
      query: { lastOperationVersion: 0 },
    });
    const previews = await request('GET', '/sync/pullpreviews', { token: bia.token });

    expect(pull.status).toBe(404);
    expect(previews.data.storyPreviews).toEqual([]);
  });

  it('lets the owner send the same story again without being asked about the old data', async () => {
    const first = await importTestStory(ana.token, 'De novo');
    const id = first.data.storyId as string;
    const exported = (await request('GET', `/stories/${id}/export`, { token: ana.token })).data;
    await markDeleted(id, 31);
    await storyRetentionService.purgeExpired();

    const again = await request('POST', '/stories/import', {
      token: ana.token,
      query: { storyId: id },
      body: exported,
    });

    expect(again.status).toBe(200);
    expect((await story(id))?.isDeleted).toBe(false);
  });
});

describe('stories of an erased account', () => {
  it('erases the stories once the owner is erased, but not while the account is only deleted', async () => {
    const { id } = await uploadTestStory(ana.token, 'Da Ana');
    const other = await uploadTestStory(bia.token, 'Da Bia');
    await userService.deleteOwnAccount(ana.userId, ana.password);

    // Deleted, inside its grace: the person may come back.
    expect(await storyRetentionService.purgeExpired()).toEqual({
      deleted: 0,
      orphaned: 0,
      failed: 0,
    });
    expect(await story(id)).toBeDefined();

    await userService.pruneDeletedAccounts(0, new Date(Date.now() + DAY));
    const outcome = await storyRetentionService.purgeExpired();

    expect(outcome).toEqual({ deleted: 0, orphaned: 1, failed: 0 });
    expect(await story(id)).toBeUndefined();
    expect(await story(other.id)).toBeDefined();
  });

  it('counts a story once when it is both deleted long ago and orphaned', async () => {
    const { id } = await uploadTestStory(ana.token, 'Dupla razão');
    await markDeleted(id, 90);
    await userService.deleteOwnAccount(ana.userId, ana.password);
    await userService.pruneDeletedAccounts(0, new Date(Date.now() + DAY));

    const outcome = await storyRetentionService.purgeExpired();

    expect(outcome.deleted + outcome.orphaned).toBe(1);
    expect(outcome.failed).toBe(0);
    expect(await story(id)).toBeUndefined();
  });
});
