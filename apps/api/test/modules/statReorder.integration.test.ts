import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { stats, stories } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Stats are ordered from zero, derived from their ranks like every arranged row: moving a stat is
 * an edit of that stat, over the HTTP sync boundary, and the story is no container version any
 * more.
 */
let ana: TestUser;
let storyId: string;
let courageId: string;
let wisdomId: string;

const push = (body: Record<string, unknown>[]) =>
  request('POST', `/sync/${storyId}`, {
    token: ana.token,
    body: body.map((update) => ({ clientOperationId: newId(), ...update })),
  });

const statPlaces = async () => {
  const rows = await db
    .select({ id: stats.id, order: stats.order, version: stats.version })
    .from(stats)
    .where(and(eq(stats.storyId, storyId), eq(stats.isDeleted, false)));
  return Object.fromEntries(rows.map((row) => [row.id, [row.order, row.version]]));
};

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
  [courageId, wisdomId] = [newId(), newId()];
  await db.insert(stats).values([
    { id: courageId, storyId, name: 'Courage', order: 0, version: 1 },
    { id: wisdomId, storyId, name: 'Wisdom', order: 1, version: 1 },
  ]);
});

describe('moving a stat', () => {
  it('orders from zero by rank, editing only the stat that moved', async () => {
    const { data } = await push([
      {
        type: 'update',
        entity: 'Stat',
        id: wisdomId,
        version: 1,
        changes: { rank: 'a0', version: 1 },
      },
    ]);

    expect(data.conflicts ?? []).toEqual([]);
    expect(await statPlaces()).toEqual({ [wisdomId]: [0, 2], [courageId]: [1, 1] });
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(story?.version).toBe(1);
  });

  it('refuses a rank no device could have written', async () => {
    const { data } = await push([
      {
        type: 'update',
        entity: 'Stat',
        id: wisdomId,
        version: 1,
        changes: { rank: 'not a rank', version: 1 },
      },
    ]);

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
    expect(await statPlaces()).toEqual({ [courageId]: [0, 1], [wisdomId]: [1, 1] });
  });

  it('refuses a container order of the stats', async () => {
    const { data } = await push([
      {
        type: 'reorder',
        entity: 'Story',
        id: storyId,
        version: 1,
        reorderTarget: 'Stat',
        reorderItems: [
          { id: wisdomId, newIndex: 1 },
          { id: courageId, newIndex: 2 },
        ],
      },
    ]);

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
    expect(await statPlaces()).toEqual({ [courageId]: [0, 1], [wisdomId]: [1, 1] });
  });
});
