import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { favorites, operationLog, stories } from '../../src/db/schema';
import { newId, registerUser, request, uploadTestStory, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let bia: TestUser;
let storyId: string;

const pull = (token: string, query: Record<string, number | undefined> = {}) =>
  request('GET', `/sync/${storyId}/pull`, {
    token,
    query: { lastOperationVersion: 0, lastPublicFavoriteVersion: 0, ...query },
  });

/** Favorite rows with no operation logs, exactly what a story import leaves behind. */
async function seedUnloggedFavorites(userId: string, total: number): Promise<void> {
  const now = new Date();
  for (let index = 0; index < total; index += 1) {
    await db.insert(favorites).values({
      id: newId(),
      storyId,
      entityId: newId(),
      entityType: 'Character',
      userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }
}

async function makeStoryPublic(): Promise<void> {
  await db
    .update(stories)
    .set({ favoriteBehavior: 'individual_public' })
    .where(eq(stories.id, storyId));
}

async function favoriteCreateLogs(): Promise<{ entityId: string }[]> {
  return db
    .select({ entityId: operationLog.entityId })
    .from(operationLog)
    .where(
      and(
        eq(operationLog.storyId, storyId),
        eq(operationLog.entityType, 'Favorite'),
        eq(operationLog.operationType, 'create'),
      ),
    );
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('conditional public-favorites snapshot', () => {
  it('skips the roster and the repair when the fingerprint matches', async () => {
    await makeStoryPublic();
    await seedUnloggedFavorites(bia.userId, 2);

    const { status, data } = await pull(ana.token, { favoritesCount: 2, favoritesMaxVersion: 1 });

    expect(status).toBe(200);
    expect(data.publicFavorites).toEqual([]);
    expect(data.favoritesFingerprint).toEqual({ count: 2, maxVersion: 1 });
    // The repair did not run either: unlogged rows stay unlogged until something changes.
    expect(await favoriteCreateLogs()).toHaveLength(0);
  });

  it('repairs and sends the roster once on mismatch', async () => {
    await makeStoryPublic();
    await seedUnloggedFavorites(bia.userId, 2);

    const { status, data } = await pull(ana.token, { favoritesCount: 0, favoritesMaxVersion: 0 });

    expect(status).toBe(200);
    expect(data.publicFavorites).toHaveLength(2);
    expect(data.favoritesFingerprint).toEqual({ count: 2, maxVersion: 1 });
    expect(await favoriteCreateLogs()).toHaveLength(2);

    // Converged: the numbers just received now match, so the next pull is quiet.
    const quiet = await pull(ana.token, { favoritesCount: 2, favoritesMaxVersion: 1 });
    expect(quiet.data.publicFavorites).toEqual([]);
  });

  it('keeps the legacy always-send behaviour without fingerprint params', async () => {
    await makeStoryPublic();
    await seedUnloggedFavorites(bia.userId, 1);

    const { status, data } = await pull(ana.token);

    expect(status).toBe(200);
    expect(data.publicFavorites).toHaveLength(1);
    expect(data.favoritesFingerprint).toEqual({ count: 1, maxVersion: 1 });
    expect(await favoriteCreateLogs()).toHaveLength(1);
  });

  it('ignores the fingerprint entirely for private stories', async () => {
    await seedUnloggedFavorites(bia.userId, 1);

    const { status, data } = await pull(ana.token, { favoritesCount: 99, favoritesMaxVersion: 99 });

    expect(status).toBe(200);
    expect(data.publicFavorites).toEqual([]);
    expect('favoritesFingerprint' in data).toBe(false);
    expect(await favoriteCreateLogs()).toHaveLength(0);
  });
});

describe('event-driven public-favorite repair', () => {
  it('repairs when a push flips the story to public', async () => {
    await seedUnloggedFavorites(bia.userId, 2);
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });

    const { status, data } = await request('POST', `/sync/${storyId}`, {
      token: ana.token,
      body: [
        {
          type: 'update',
          entity: 'Story',
          id: storyId,
          version: story!.version,
          changes: { favoriteBehavior: 'individual_public', version: story!.version },
          clientOperationId: 'local-flip',
        },
      ],
    });

    expect(status).toBe(200);
    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
    expect(await favoriteCreateLogs()).toHaveLength(2);
  });
});
