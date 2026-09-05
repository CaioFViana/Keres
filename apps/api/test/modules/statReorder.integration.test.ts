import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { stats, stories } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Stats are ordered locally from zero, but Story reorder operations use the shared one-based
 * protocol. These tests exercise the HTTP sync boundary so a stat reorder cannot accidentally fall
 * through to chapter reorder handling when another Story collection gains its own order.
 */
let ana: TestUser;
let storyId: string;
let courageId: string;
let wisdomId: string;

const reorder = (reorderItems: { id: string; newIndex: number }[]) =>
  request('POST', `/sync/${storyId}`, {
    token: ana.token,
    body: [
      {
        clientOperationId: newId(),
        type: 'reorder',
        entity: 'Story',
        id: storyId,
        reorderTarget: 'Stat',
        reorderItems,
        version: 1,
      },
    ],
  });

const statOrders = async () => {
  const rows = await db
    .select({ id: stats.id, order: stats.order })
    .from(stats)
    .where(and(eq(stats.storyId, storyId), eq(stats.isDeleted, false)));
  return Object.fromEntries(rows.map((row) => [row.id, row.order]));
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

describe('reordering stats', () => {
  it('accepts a complete Stat target and stores its indexes zero-based', async () => {
    const { data } = await reorder([
      { id: wisdomId, newIndex: 1 },
      { id: courageId, newIndex: 2 },
    ]);

    expect(data.conflicts ?? []).toEqual([]);
    expect(await statOrders()).toEqual({ [wisdomId]: 0, [courageId]: 1 });
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(story?.version).toBe(2);
  });

  it('rejects a partial Stat target without changing its order', async () => {
    const { data } = await reorder([{ id: wisdomId, newIndex: 1 }]);

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
    expect(await statOrders()).toEqual({ [courageId]: 0, [wisdomId]: 1 });
  });
});
