/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The choice service's listing: the branching-aware filters no sibling list has.
 *
 * Choices are found through the graph, not through their own columns: by the scene they leave,
 * by the chapter holding that scene, by the scene they lead to, and by free text across the label
 * and the author notes. The chapter filter is a subquery over scenes, so it has to skip tombstoned
 * scenes - a deleted scene must not keep its choices visible in its chapter's list. CRUD already
 * lives in `choiceMechanicServices.test.ts`.
 *
 * Two paths are deliberately not covered: the "the write returned no row" guard in `deleteChoice`
 * and the catch in `getAllByStoryId`, which need the database itself to misbehave.
 */

let database: TestDatabase;

const seedScene = async (id: string, chapterId: string | null): Promise<void> => {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId,
    name: `Scene ${id}`,
    index: 1,
    ...entityBase,
    deletedAt: null,
  });
};

const seedChoice = async (
  id: string,
  sceneId: string,
  nextSceneId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> => {
  await database.db.insert(schema.choices).values({
    id,
    storyId: TEST_STORY_ID,
    sceneId,
    nextSceneId,
    text: `Choice ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.chapters).values([
    {
      id: 'chapter-1',
      storyId: TEST_STORY_ID,
      name: 'One',
      index: 1,
      ...entityBase,
      deletedAt: null,
    },
    {
      id: 'chapter-2',
      storyId: TEST_STORY_ID,
      name: 'Two',
      index: 2,
      ...entityBase,
      deletedAt: null,
    },
  ]);
  await seedScene('scene-a', 'chapter-1');
  await seedScene('scene-b', 'chapter-1');
  await seedScene('scene-c', 'chapter-2');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('ChoiceService listing', () => {
  it('matches the search term against the choice text', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b', { text: 'Open the harbor gate' });
    await seedChoice('b', 'scene-a', 'scene-c', { text: 'Walk away' });

    expect(
      (await service.getChoicesByStoryId(TEST_STORY_ID, 'HARBOR')).map((choice) => choice.id),
    ).toEqual(['a']);
  });

  it('filters by the scene a choice leaves', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b');
    await seedChoice('b', 'scene-b', 'scene-c');

    const rows = await service.getChoicesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      sceneId: 'scene-b',
    });

    expect(rows.map((choice) => choice.id)).toEqual(['b']);
  });

  it('filters by chapter through the live scenes only', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-c');
    await seedChoice('b', 'scene-c', 'scene-a');
    await database.db.insert(schema.scenes).values({
      id: 'scene-gone',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      name: 'Gone',
      index: 9,
      ...entityBase,
      isDeleted: true,
      deletedAt: null,
    });
    await seedChoice('c', 'scene-gone', 'scene-a');

    const rows = await service.getChoicesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      chapterId: 'chapter-1',
    });

    expect(rows.map((choice) => choice.id)).toEqual(['a']);
  });

  it('prefers the scene filter when both scene and chapter are given', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b');
    await seedChoice('b', 'scene-b', 'scene-c');

    const rows = await service.getChoicesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      sceneId: 'scene-a',
      chapterId: 'chapter-1',
    });

    expect(rows.map((choice) => choice.id)).toEqual(['a']);
  });

  it('filters by the scene a choice leads to', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b');
    await seedChoice('b', 'scene-a', 'scene-c');

    const rows = await service.getChoicesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      nextSceneId: 'scene-c',
    });

    expect(rows.map((choice) => choice.id)).toEqual(['b']);
  });

  it('searches the label and the author notes together', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b', { text: 'Open the gate', notes: null });
    await seedChoice('b', 'scene-a', 'scene-c', {
      text: 'Walk away',
      notes: 'only if the gate is shut',
    });
    await seedChoice('c', 'scene-a', 'scene-c', { text: 'Wait', notes: 'stall for time' });

    const rows = await service.getChoicesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      choiceSearch: 'gate',
    });

    expect(rows.map((choice) => choice.id).sort()).toEqual(['a', 'b']);
  });

  it('sorts by any column and warns on an unknown key', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b', { text: 'Bravo' });
    await seedChoice('b', 'scene-a', 'scene-c', { text: 'Alpha' });

    expect(
      (await service.getChoicesByStoryId(TEST_STORY_ID, undefined, 'text', 'asc')).map(
        (choice) => choice.id,
      ),
    ).toEqual(['b', 'a']);
    expect(
      (await service.getChoicesByStoryId(TEST_STORY_ID, undefined, 'nope', 'asc')).map(
        (choice) => choice.id,
      ),
    ).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: nope');
  });

  it('orders by creation time when no sort is requested', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b', {
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await seedChoice('b', 'scene-a', 'scene-c', {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect((await service.getChoicesByStoryId(TEST_STORY_ID)).map((choice) => choice.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('returns every live choice of the story, and nothing without a story id', async () => {
    const service = createChoiceService(database.db);
    await seedChoice('a', 'scene-a', 'scene-b');
    await seedChoice('gone', 'scene-a', 'scene-b', { isDeleted: true });

    expect((await service.getAllByStoryId(TEST_STORY_ID)).map((choice) => choice.id)).toEqual([
      'a',
    ]);
    expect(await service.getAllByStoryId('')).toEqual([]);
  });
});
