import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters } from '../../src/db/schema';
import { and, eq } from 'drizzle-orm';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Two index spaces inside one table.
 *
 * The server refuses a reorder whose payload is not exactly the story's containers, numbered 1..N
 * with no holes. Chapters and events share `chapters`, so the scope has to reach the **query** and
 * not only the validation: a payload listing every event is complete for the events and short for
 * the chapters, and a handler looking at the whole table would call one of the two a validation
 * error whichever way it was sent.
 */

let ana: TestUser;
let storyId: string;
/** Real ULIDs: `ReorderItemSchema.id` refuses anything else before the handler ever runs. */
let chapterA: string;
let chapterB: string;
let eventA: string;
let eventB: string;

const createStory = async () => {
  const { status, data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  if (status !== 200) throw new Error(`Could not create the story (${status}).`);
  return data.id as string;
};

const seedContainer = async (
  id: string,
  name: string,
  index: number,
  type: 'chapter' | 'event',
) => {
  await db.insert(chapters).values({ id, storyId, name, index, type, version: 1 });
};

const reorder = (
  reorderItems: { id: string; newIndex: number }[],
  reorderTarget?: 'Event',
  version = 1,
) =>
  request('POST', `/sync/${storyId}`, {
    token: ana.token,
    body: [
      {
        clientOperationId: newId(),
        type: 'reorder',
        entity: 'Story',
        id: storyId,
        reorderItems,
        version,
        ...(reorderTarget ? { reorderTarget } : {}),
      },
    ],
  });

const indexesOf = async (type: 'chapter' | 'event') => {
  const rows = await db
    .select({ id: chapters.id, index: chapters.index })
    .from(chapters)
    .where(and(eq(chapters.storyId, storyId), eq(chapters.type, type)));
  return Object.fromEntries(rows.map((row) => [row.id, row.index]));
};

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = await createStory();
  [chapterA, chapterB, eventA, eventB] = [newId(), newId(), newId(), newId()];
  await seedContainer(chapterA, 'A', 1, 'chapter');
  await seedContainer(chapterB, 'B', 2, 'chapter');
  await seedContainer(eventA, 'The war', 1, 'event');
  await seedContainer(eventB, 'The peace', 2, 'event');
});

describe('reordering events', () => {
  it('accepts a payload that is complete for the events alone', async () => {
    const { data } = await reorder(
      [
        { id: eventB, newIndex: 1 },
        { id: eventA, newIndex: 2 },
      ],
      'Event',
    );

    expect(data.conflicts ?? []).toEqual([]);
    expect(await indexesOf('event')).toEqual({ [eventB]: 1, [eventA]: 2 });
  });

  /** The spine is untouched: the two spaces are numbered independently. */
  it('leaves the chapters where they were', async () => {
    await reorder(
      [
        { id: eventB, newIndex: 1 },
        { id: eventA, newIndex: 2 },
      ],
      'Event',
    );

    expect(await indexesOf('chapter')).toEqual({ [chapterA]: 1, [chapterB]: 2 });
  });

  it('refuses a payload missing one of the events', async () => {
    const { data } = await reorder([{ id: eventA, newIndex: 1 }], 'Event');

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
    expect(await indexesOf('event')).toEqual({ [eventA]: 1, [eventB]: 2 });
  });

  /** A chapter is not part of the event space, even though it is in the same table. */
  it('refuses a payload that mixes in a chapter', async () => {
    const { data } = await reorder(
      [
        { id: eventA, newIndex: 1 },
        { id: eventB, newIndex: 2 },
        { id: chapterA, newIndex: 3 },
      ],
      'Event',
    );

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
  });
});

describe('reordering chapters', () => {
  /**
   * No `reorderTarget` at all, which is what this operation looked like before events existed. An
   * older client sends exactly this, and it has to keep meaning the chapters.
   */
  it('accepts a payload complete for the chapters, with no target named', async () => {
    const { data } = await reorder([
      { id: chapterB, newIndex: 1 },
      { id: chapterA, newIndex: 2 },
    ]);

    expect(data.conflicts ?? []).toEqual([]);
    expect(await indexesOf('chapter')).toEqual({ [chapterB]: 1, [chapterA]: 2 });
  });

  it('leaves the events where they were', async () => {
    await reorder([
      { id: chapterB, newIndex: 1 },
      { id: chapterA, newIndex: 2 },
    ]);

    expect(await indexesOf('event')).toEqual({ [eventA]: 1, [eventB]: 2 });
  });

  /**
   * The reason the filter belongs in the query. Before events, "every row in the table" and "every
   * chapter" were the same set; a complete chapter payload would now look short against the four.
   */
  it('is not judged against the events it does not include', async () => {
    const { data } = await reorder([
      { id: chapterA, newIndex: 1 },
      { id: chapterB, newIndex: 2 },
    ]);

    expect(data.conflicts ?? []).toEqual([]);
  });

  it('refuses a payload that mixes in an event', async () => {
    const { data } = await reorder([
      { id: chapterA, newIndex: 1 },
      { id: chapterB, newIndex: 2 },
      { id: eventA, newIndex: 3 },
    ]);

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
  });

  it('still refuses indices with a hole in them', async () => {
    const { data } = await reorder([
      { id: chapterA, newIndex: 1 },
      { id: chapterB, newIndex: 3 },
    ]);

    expect(data.conflicts?.[0]).toMatchObject({ reason: 'validation' });
  });
});

describe('the column itself', () => {
  it('defaults a container to being a chapter', async () => {
    const id = newId();
    await db.insert(chapters).values({ id, storyId, name: 'Plain', index: 3, version: 1 });

    const [row] = await db.select().from(chapters).where(eq(chapters.id, id));
    expect(row.type).toBe('chapter');
  });
});
