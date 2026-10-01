/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The scene service's read side and mutation edges.
 *
 * The index invariants (1..N per chapter, gap closing, reorder validation) already live in
 * `SceneIndexing.test.ts`. What was missing is everything a list screen leans on: the search term,
 * the favorite filter, the sort switch, and the previous/next walk inside a chapter. A wrong default
 * sort here silently reorders the writer's narrative in every list at once.
 *
 * The edges (unknown id on update/delete, an update that changes nothing, a batch naming a scene
 * that does not exist) are the paths a sync pull and a stale form hit in production: they must be
 * quiet no-ops or loud errors, never half-writes.
 *
 * Two throws are deliberately not covered: the "failed to retrieve the row we just wrote" guards in
 * `updateScene`/`deleteScene`, which need the row to vanish between two statements of the same call.
 */

let database: TestDatabase;

const seedScene = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: 'chapter-1',
    locationId: 'location-1',
    name: `Scene ${id}`,
    index: 1,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

const operationCount = async (): Promise<number> =>
  (await database.db.query.operationLogs.findMany()).length;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.locations).values({
    id: 'location-1',
    storyId: TEST_STORY_ID,
    name: 'The harbor',
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.chapters).values({
    id: 'chapter-1',
    storyId: TEST_STORY_ID,
    name: 'Chapter one',
    index: 1,
    ...entityBase,
    deletedAt: null,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('SceneService listing', () => {
  it('matches the search term case-insensitively and hides deleted scenes', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { name: 'Arrival at the harbor' });
    await seedScene('b', { name: 'Departure' });
    await seedScene('c', { name: 'Harbor lights', isDeleted: true });

    const found = await service.getScenesByStoryId(TEST_STORY_ID, 'HARBOR');

    expect(found.map((scene) => scene.id)).toEqual(['a']);
  });

  it('filters by favorite state in both directions', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { isFavorite: true });
    await seedScene('b', { isFavorite: false });

    expect(
      (await service.getScenesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'favorite')).map(
        (scene) => scene.id,
      ),
    ).toEqual(['a']);
    expect(
      (await service.getScenesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'not-favorite')).map(
        (scene) => scene.id,
      ),
    ).toEqual(['b']);
  });

  it('sorts by name, index and timestamps in both directions', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', {
      name: 'Bravo',
      index: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await seedScene('b', {
      name: 'Alpha',
      index: 2,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    const byName = await service.getScenesByStoryId(TEST_STORY_ID, undefined, 'name', 'asc');
    expect(byName.map((scene) => scene.id)).toEqual(['b', 'a']);
    const byNameDesc = await service.getScenesByStoryId(TEST_STORY_ID, undefined, 'name', 'desc');
    expect(byNameDesc.map((scene) => scene.id)).toEqual(['a', 'b']);
    const byIndex = await service.getScenesByStoryId(TEST_STORY_ID, undefined, 'index', 'asc');
    expect(byIndex.map((scene) => scene.id)).toEqual(['a', 'b']);
    const byCreated = await service.getScenesByStoryId(
      TEST_STORY_ID,
      undefined,
      'createdAt',
      'asc',
    );
    expect(byCreated.map((scene) => scene.id)).toEqual(['a', 'b']);
    const byUpdated = await service.getScenesByStoryId(
      TEST_STORY_ID,
      undefined,
      'updatedAt',
      'desc',
    );
    expect(byUpdated.map((scene) => scene.id)).toEqual(['a', 'b']);
  });

  it('warns and still returns the list on an unknown sort key', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { index: 2 });
    await seedScene('b', { index: 1 });

    const rows = await service.getScenesByStoryId(TEST_STORY_ID, undefined, 'nope', 'asc');

    expect(rows.map((scene) => scene.id).sort()).toEqual(['a', 'b']);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: nope');
  });

  it('orders by index when no sort is requested', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { index: 2 });
    await seedScene('b', { index: 1 });

    const rows = await service.getScenesByStoryId(TEST_STORY_ID);

    expect(rows.map((scene) => scene.id)).toEqual(['b', 'a']);
  });

  it('applies advanced criteria to narrow the list', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { name: 'Arrival' });
    await seedScene('b', { name: 'Departure' });

    const rows = await service.getScenesByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      name: 'Arrival',
    });

    expect(rows.map((scene) => scene.id)).toEqual(['a']);
  });

  it('returns every live scene of the story in index order', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { index: 2 });
    await seedScene('b', { index: 1 });
    await seedScene('gone', { index: 3, isDeleted: true });

    expect((await service.getAllByStoryId(TEST_STORY_ID)).map((scene) => scene.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('returns an empty list when the story id is missing instead of scanning the table', async () => {
    const service = createSceneService(database.db);
    await seedScene('a');

    expect(await service.getAllByStoryId('')).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('getAllByStoryId: storyId is required.');
  });

  it('counts only live scenes, optionally scoped to a story', async () => {
    const service = createSceneService(database.db);
    await seedScene('a');
    await seedScene('gone', { isDeleted: true });

    expect(await service.getSceneCount(TEST_STORY_ID)).toBe(1);
    expect(await service.getSceneCount()).toBe(1);
  });
});

describe('SceneService mutation edges', () => {
  it('refuses to update a scene that does not exist', async () => {
    const service = createSceneService(database.db);

    await expect(service.updateScene(TEST_USER_ID, 'missing', { name: 'X' })).rejects.toThrow(
      'not found for update',
    );
    expect(await operationCount()).toBe(0);
  });

  it('skips the write and the operation log when nothing changed', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { name: 'Arrival' });

    const result = await service.updateScene(TEST_USER_ID, 'a', { name: 'Arrival' });

    expect(result.name).toBe('Arrival');
    expect(await operationCount()).toBe(0);
  });

  it('ignores a delete for a scene that does not exist', async () => {
    const service = createSceneService(database.db);

    await service.deleteScene(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent scene missing.');
    expect(await operationCount()).toBe(0);
  });

  it('batch-updates several scenes and skips the unknown ids', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { name: 'Old A' });
    await seedScene('b', { name: 'Old B' });

    await service.batchUpdateScenes(TEST_USER_ID, TEST_STORY_ID, [
      { sceneId: 'a', changes: { name: 'New A' } },
      { sceneId: 'missing', changes: { name: 'Nowhere' } },
      { sceneId: 'b', changes: { name: 'New B' } },
    ]);

    expect((await service.getById('a'))?.name).toBe('New A');
    expect((await service.getById('b'))?.name).toBe('New B');
    expect(console.warn).toHaveBeenCalledWith(
      'Scene with ID missing not found during batch update.',
    );
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(2);
    expect(logged.map((operation) => operation.entityId).sort()).toEqual(['a', 'b']);
  });
});

describe('SceneService neighbors', () => {
  it('walks unchaptered scenes by name instead of by index', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { chapterId: null, name: 'Bravo', index: 1 });
    await seedScene('b', { chapterId: null, name: 'Alpha', index: 2 });
    await seedScene('c', { chapterId: null, name: 'Charlie', index: 3 });

    const neighbors = await service.getPreviousNextScenes(TEST_STORY_ID, 'a', null);

    expect(neighbors.previousScene?.id).toBe('b');
    expect(neighbors.nextScene?.id).toBe('c');
  });

  it('leaves the missing neighbor undefined at both ends of the chapter', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', { index: 1 });
    await seedScene('b', { index: 2 });

    const first = await service.getPreviousNextScenes(TEST_STORY_ID, 'a', 'chapter-1');
    expect(first.previousScene).toBeUndefined();
    expect(first.nextScene?.id).toBe('b');

    const last = await service.getPreviousNextScenes(TEST_STORY_ID, 'b', 'chapter-1');
    expect(last.previousScene?.id).toBe('a');
    expect(last.nextScene).toBeUndefined();
  });

  it('keeps neighbors inside the requested chapter', async () => {
    const service = createSceneService(database.db);
    await database.db.insert(schema.chapters).values({
      id: 'chapter-2',
      storyId: TEST_STORY_ID,
      name: 'Chapter two',
      index: 2,
      ...entityBase,
      deletedAt: null,
    });
    await seedScene('a', { chapterId: 'chapter-1', index: 1 });
    await seedScene('b', { chapterId: 'chapter-2', index: 1 });
    expect(
      (await database.db.query.scenes.findMany({ where: eq(schema.scenes.id, 'b') })).length,
    ).toBe(1);

    const neighbors = await service.getPreviousNextScenes(TEST_STORY_ID, 'a', 'chapter-1');

    expect(neighbors.previousScene).toBeUndefined();
    expect(neighbors.nextScene).toBeUndefined();
  });
});
