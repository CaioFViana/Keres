import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Two index spaces inside one table, over the wire.
 *
 * Chapters and events share `chapters`, each kind numbered 1..N on its own. A container's place is
 * its rank, written like any field of that one row; the numbers are derived from the ranks of the
 * kind it belongs to, so moving an event never touches a chapter, and converting a container moves
 * it from one space to the other in one edit.
 */

let ana: TestUser;
let storyId: string;
let chapterA: string;
let chapterB: string;
let eventA: string;
let eventB: string;

const seedContainer = async (
  id: string,
  name: string,
  index: number,
  type: 'chapter' | 'event',
) => {
  await db.insert(chapters).values({ id, storyId, name, index, type, version: 1 });
};

const push = (body: Record<string, unknown>[]) =>
  request('POST', `/sync/${storyId}`, {
    token: ana.token,
    body: body.map((update) => ({ clientOperationId: newId(), ...update })),
  });

const edit = (id: string, changes: Record<string, unknown>, version = 1) =>
  push([{ type: 'update', entity: 'Chapter', id, version, changes: { ...changes, version } }]);

const placesOf = async (type: 'chapter' | 'event') => {
  const rows = await db
    .select({ id: chapters.id, index: chapters.index, version: chapters.version })
    .from(chapters)
    .where(and(eq(chapters.storyId, storyId), eq(chapters.type, type)));
  return Object.fromEntries(rows.map((row) => [row.id, [row.index, row.version]]));
};

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
  [chapterA, chapterB, eventA, eventB] = [newId(), newId(), newId(), newId()];
  await seedContainer(chapterA, 'A', 1, 'chapter');
  await seedContainer(chapterB, 'B', 2, 'chapter');
  await seedContainer(eventA, 'The war', 1, 'event');
  await seedContainer(eventB, 'The peace', 2, 'event');
});

describe('moving an event', () => {
  it('renumbers the events alone, editing only the event that moved', async () => {
    // Before the first event's legacy rank (`a1`).
    const { data } = await edit(eventB, { rank: 'a0' });

    expect(data.conflicts ?? []).toEqual([]);
    expect(await placesOf('event')).toEqual({ [eventB]: [1, 2], [eventA]: [2, 1] });
    expect(await placesOf('chapter')).toEqual({ [chapterA]: [1, 1], [chapterB]: [2, 1] });
  });

  it('never takes a number an update carries next to a rank: it derives from the rank', async () => {
    const { data } = await edit(eventA, { index: 9, rank: 'a1', name: 'The long war' });

    expect(data.conflicts ?? []).toEqual([]);
    expect(await placesOf('event')).toEqual({ [eventA]: [1, 2], [eventB]: [2, 1] });
  });

  /** A number is derived: an update carrying one moves nothing - a move is a rank edit. */
  it('ignores the number an update carries', async () => {
    const { data } = await edit(eventA, { index: 9 });

    // Applied as an edit with nothing in it (one version up), and the row stays where it was.
    expect(data.conflicts ?? []).toEqual([]);
    expect(await placesOf('event')).toEqual({ [eventA]: [1, 2], [eventB]: [2, 1] });
  });
});

describe('converting a container', () => {
  it('moves it between the spaces in one edit, both renumbering from their ranks', async () => {
    // Into the events, ahead of both.
    const { data } = await edit(chapterA, { type: 'event', rank: 'a0' });

    expect(data.conflicts ?? []).toEqual([]);
    expect(await placesOf('chapter')).toEqual({ [chapterB]: [1, 1] });
    expect(await placesOf('event')).toEqual({
      [chapterA]: [1, 2],
      [eventA]: [2, 1],
      [eventB]: [3, 1],
    });
  });
});
