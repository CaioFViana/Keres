/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createNoteService } from '../../src/services/storymanagement/NoteService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The note service's listing, tag grouping and mutation edges.
 *
 * Notes are the only entity whose list pre-filters by tag ids in a separate query before the main
 * one: when no live note carries the tag the service returns `[]` without touching the join at all.
 * The main query then left-joins tags twice-guarded (the relation row and the tag row must both be
 * live), and the same grouping code is duplicated in `getById`, so both need their own deleted-tag
 * case.
 *
 * Two throws are deliberately not covered: the "failed to retrieve the row we just wrote" guards in
 * `updateNote`/`deleteNote`, which need the row to vanish between two statements of the same call.
 */

let database: TestDatabase;

const seedNote = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.notes).values({
    id,
    storyId: TEST_STORY_ID,
    title: `Note ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

const seedTaggedNote = async (noteId: string, tagId: string): Promise<void> => {
  await database.db.insert(schema.tags).values({
    id: tagId,
    storyId: TEST_STORY_ID,
    name: `Tag ${tagId}`,
    ...entityBase,
  });
  await database.db.insert(schema.tagRelations).values({
    id: `rel-${noteId}-${tagId}`,
    storyId: TEST_STORY_ID,
    tagId,
    relationId: noteId,
    relationType: 'Note',
    ...entityBase,
    deletedAt: null,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('NoteService listing', () => {
  it('matches the search term against the title only', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', { title: 'Harbor dues', body: 'nothing' });
    await seedNote('b', { title: 'Supplies', body: 'harbor rope' });

    expect(
      (await service.getNotesByStoryId(TEST_STORY_ID, 'HARBOR')).map((note) => note.id),
    ).toEqual(['a']);
  });

  it('filters by tags and returns nothing when no note carries them', async () => {
    const service = createNoteService(database.db);
    await seedNote('a');
    await seedNote('b');
    await seedTaggedNote('a', 't-quest');

    expect(
      (await service.getNotesByStoryId(TEST_STORY_ID, undefined, ['t-quest'])).map(
        (note) => note.id,
      ),
    ).toEqual(['a']);
    expect(await service.getNotesByStoryId(TEST_STORY_ID, undefined, ['t-missing'])).toEqual([]);
  });

  it('filters by favorite state in both directions', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', { isFavorite: true });
    await seedNote('b', { isFavorite: false });

    expect(
      (
        await service.getNotesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          null,
          'asc',
          'favorite',
        )
      ).map((note) => note.id),
    ).toEqual(['a']);
    expect(
      (
        await service.getNotesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          null,
          'asc',
          'not-favorite',
        )
      ).map((note) => note.id),
    ).toEqual(['b']);
  });

  it('sorts by title and timestamps, and warns on an unknown key', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', {
      title: 'Bravo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await seedNote('b', {
      title: 'Alpha',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    expect(
      (await service.getNotesByStoryId(TEST_STORY_ID, undefined, undefined, 'title', 'asc')).map(
        (note) => note.id,
      ),
    ).toEqual(['b', 'a']);
    expect(
      (
        await service.getNotesByStoryId(TEST_STORY_ID, undefined, undefined, 'createdAt', 'desc')
      ).map((note) => note.id),
    ).toEqual(['b', 'a']);
    expect(
      (
        await service.getNotesByStoryId(TEST_STORY_ID, undefined, undefined, 'updatedAt', 'asc')
      ).map((note) => note.id),
    ).toEqual(['b', 'a']);
    expect(
      (await service.getNotesByStoryId(TEST_STORY_ID, undefined, undefined, 'nope', 'asc')).map(
        (note) => note.id,
      ),
    ).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: nope');
  });

  it('orders by title when no sort is requested', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', { title: 'Bravo' });
    await seedNote('b', { title: 'Alpha' });

    expect((await service.getNotesByStoryId(TEST_STORY_ID)).map((note) => note.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('groups each note with its live tags only', async () => {
    const service = createNoteService(database.db);
    await seedNote('a');
    await seedTaggedNote('a', 't-live');
    await database.db.insert(schema.tags).values({
      id: 't-gone',
      storyId: TEST_STORY_ID,
      name: 'Gone',
      ...entityBase,
      isDeleted: true,
    });
    await database.db.insert(schema.tagRelations).values({
      id: 'rel-a-gone',
      storyId: TEST_STORY_ID,
      tagId: 't-gone',
      relationId: 'a',
      relationType: 'Note',
      ...entityBase,
      deletedAt: null,
    });

    const rows = await service.getNotesByStoryId(TEST_STORY_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags.map((tag) => tag.id)).toEqual(['t-live']);
  });
});

describe('NoteService getById', () => {
  it('returns the note with its tags attached', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', { title: 'Harbor dues' });
    await seedTaggedNote('a', 't-quest');

    const found = await service.getById('a');

    expect(found).toMatchObject({ id: 'a', title: 'Harbor dues' });
    expect(found?.tags.map((tag) => tag.id)).toEqual(['t-quest']);
  });

  it('returns undefined for a missing or deleted note', async () => {
    const service = createNoteService(database.db);
    await seedNote('gone', { isDeleted: true });

    expect(await service.getById('missing')).toBeUndefined();
    expect(await service.getById('gone')).toBeUndefined();
  });
});

describe('NoteService mutation edges', () => {
  it('refuses to update a note that does not exist', async () => {
    const service = createNoteService(database.db);

    await expect(service.updateNote(TEST_USER_ID, 'missing', { title: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('skips the write and the operation log when nothing changed', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', { title: 'Harbor dues' });

    await service.updateNote(TEST_USER_ID, 'a', { title: 'Harbor dues' });

    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('ignores a delete for a note that does not exist', async () => {
    const service = createNoteService(database.db);

    await service.deleteNote(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent note missing.');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('logs the computed diff on update, not the raw form input', async () => {
    const service = createNoteService(database.db);
    await seedNote('a', { title: 'Harbor dues', body: 'Pay up' });

    await service.updateNote(TEST_USER_ID, 'a', { title: 'Harbor dues paid', body: 'Pay up' });

    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'Note', operationType: 'update' });
    expect(String(logged[0]?.payload)).toContain('Harbor dues paid');
    expect(String(logged[0]?.payload)).not.toContain('Pay up');
  });
});
