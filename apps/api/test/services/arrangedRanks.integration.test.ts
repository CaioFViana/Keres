import { rankAtPosition } from '@keres/shared';
import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, locations, scenes, stats, stories, users } from '../../src/db/schema';
import {
  movesArrangedRows,
  normalizeArrangedUpdate,
  renumberAllArranged,
  renumberArranged,
} from '../../src/services/sync/arrangedRanks';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Positions on the server: a row's place is its rank, and `index`/`order` are derived from the
 * ranks after every write that can move a row - in code, never by an SQL sort (Postgres compares
 * text under a linguistic collation, which does not order ranks the way the devices do).
 */
let storyId: string;
let chapterId: string;
let locationId: string;

const scenesOf = async (container: string) =>
  (
    await db
      .select({
        id: scenes.id,
        index: scenes.index,
        rank: scenes.rank,
        version: scenes.version,
        isDeleted: scenes.isDeleted,
      })
      .from(scenes)
      .where(eq(scenes.chapterId, container))
      .orderBy(asc(scenes.id))
  ).map((row) => ({ ...row }));

beforeEach(async () => {
  await truncateAll();
  const userId = newId();
  storyId = newId();
  chapterId = newId();
  locationId = newId();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db
    .insert(stories)
    .values({ id: storyId, userId, title: 'A ilha', type: 'linear' } as never);
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'Um', index: 1 } as never);
  await db.insert(locations).values({ id: locationId, storyId, name: 'A praia' } as never);
});

const insertScene = (
  id: string,
  index: number,
  rank: string,
  extra: Record<string, unknown> = {},
) =>
  db.insert(scenes).values({
    id,
    storyId,
    chapterId,
    locationId,
    name: id,
    index,
    rank,
    ...extra,
  } as never);

describe('renumberArranged', () => {
  it('numbers a container from its ranks without moving any version', async () => {
    // Uppercase sorts before lowercase in the ranks' byte order - a linguistic collation would not.
    await insertScene('s-a', 7, 'a1');
    await insertScene('s-b', 1, 'Zz');
    await insertScene('s-c', 1, 'a1V');

    await renumberArranged(db, storyId, 'Scene');

    expect(await scenesOf(chapterId)).toEqual([
      { id: 's-a', index: 2, rank: 'a1', version: 1, isDeleted: false },
      { id: 's-b', index: 1, rank: 'Zz', version: 1, isDeleted: false },
      { id: 's-c', index: 3, rank: 'a1V', version: 1, isDeleted: false },
    ]);
  });

  it('gives a row without a rank the one its position implies, and a tombstone no place', async () => {
    await insertScene('s-a', 2, '');
    await insertScene('s-b', 1, '');
    await insertScene('s-gone', 3, 'a3', { isDeleted: true });

    await renumberArranged(db, storyId, 'Scene');

    expect(await scenesOf(chapterId)).toEqual([
      { id: 's-a', index: 2, rank: rankAtPosition(2), version: 1, isDeleted: false },
      { id: 's-b', index: 1, rank: rankAtPosition(1), version: 1, isDeleted: false },
      { id: 's-gone', index: 0, rank: 'a3', version: 1, isDeleted: true },
    ]);
  });

  it('numbers stats from zero and every arranged entity after an import', async () => {
    await db.insert(stats).values([
      { id: 'st-1', storyId, name: 'Força', order: 4, rank: 'a2' },
      { id: 'st-2', storyId, name: 'Graça', order: 9, rank: '' },
    ] as never);

    await renumberAllArranged(db, storyId);

    const rows = await db
      .select({ id: stats.id, order: stats.order, rank: stats.rank })
      .from(stats)
      .orderBy(asc(stats.order));
    // An empty rank takes its 0-based order's legacy key (wire index order + 1).
    expect(rows).toEqual([
      { id: 'st-1', order: 0, rank: 'a2' },
      { id: 'st-2', order: 1, rank: rankAtPosition(10) },
    ]);
  });
});

describe('normalizeArrangedUpdate', () => {
  it('never lets an update write a derived position: a move is a rank edit', () => {
    const update = normalizeArrangedUpdate({
      type: 'update',
      entity: 'Scene',
      id: 's-1',
      version: 1,
      changes: { index: 4, name: 'N', version: 1 },
    } as never) as { changes: Record<string, unknown> };
    expect(update.changes).toEqual({ name: 'N', version: 1 });

    const ranked = normalizeArrangedUpdate({
      type: 'update',
      entity: 'Stat',
      id: 'st-1',
      version: 1,
      changes: { order: 2, rank: 'a0V', version: 1 },
    } as never) as { changes: Record<string, unknown> };
    expect(ranked.changes).toEqual({ rank: 'a0V', version: 1 });
  });

  it('ranks a create without one from its position, and leaves other entities alone', () => {
    const create = normalizeArrangedUpdate({
      type: 'create',
      entity: 'Chapter',
      id: 'c-1',
      data: { name: 'C', index: 3 },
    } as never) as { data: Record<string, unknown> };
    expect(create.data.rank).toBe(rankAtPosition(3));
    const character = { type: 'update', entity: 'Character', id: 'x', changes: { index: 1 } };
    expect(normalizeArrangedUpdate(character as never)).toBe(character);
  });
});

describe('movesArrangedRows', () => {
  it('holds for what can change a container or a place, and nothing else', () => {
    const update = (changes: Record<string, unknown>) =>
      ({ type: 'update', entity: 'Scene', id: 's', changes }) as never;
    expect(movesArrangedRows(update({ rank: 'a1' }))).toBe(true);
    expect(movesArrangedRows(update({ chapterId: 'c' }))).toBe(true);
    expect(movesArrangedRows(update({ isDeleted: false }))).toBe(true);
    expect(movesArrangedRows(update({ name: 'N' }))).toBe(false);
    expect(movesArrangedRows({ type: 'delete', entity: 'Stat', id: 's' } as never)).toBe(true);
    expect(movesArrangedRows({ type: 'create', entity: 'Character', id: 'c' } as never)).toBe(
      false,
    );
  });
});
