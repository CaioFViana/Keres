/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createTagService } from '../../src/services/storymanagement/TagService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The tag service's listing, sort switch and mutation edges.
 *
 * Tags are the filter vocabulary of every other list, so their own list has to be exact: the
 * id-set filter the multi-select writes, the favorite filter in both directions, and the sort
 * switch with its warn-and-list fallback. The update path logs the computed diff rather than the
 * raw form input - the form sends every field, changed or not, and a sibling suite
 * (`worldbuildingEntityLifecycleServices`) already covers the happy path; here are the edges.
 *
 * Two throws are deliberately not covered: the "the write returned no row" guards in
 * `updateTag`/`deleteTag`, which need the row to vanish between two statements of the same call.
 */

let database: TestDatabase;

const seedTag = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.tags).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Tag ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
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

describe('TagService listing', () => {
  it('searches by name and narrows to an explicit id set', async () => {
    const service = createTagService(database.db);
    await seedTag('a', { name: 'Harbor crew' });
    await seedTag('b', { name: 'Forest watch' });

    expect((await service.getTagsByStoryId(TEST_STORY_ID, 'HARBOR')).map((tag) => tag.id)).toEqual([
      'a',
    ]);
    expect(
      (await service.getTagsByStoryId(TEST_STORY_ID, undefined, ['b'])).map((tag) => tag.id),
    ).toEqual(['b']);
  });

  it('filters by favorite state in both directions', async () => {
    const service = createTagService(database.db);
    await seedTag('a', { isFavorite: true });
    await seedTag('b', { isFavorite: false });

    expect(
      (
        await service.getTagsByStoryId(TEST_STORY_ID, undefined, undefined, null, 'asc', 'favorite')
      ).map((tag) => tag.id),
    ).toEqual(['a']);
    expect(
      (
        await service.getTagsByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          null,
          'asc',
          'not-favorite',
        )
      ).map((tag) => tag.id),
    ).toEqual(['b']);
  });

  it('sorts by name and timestamps, and warns on an unknown key', async () => {
    const service = createTagService(database.db);
    await seedTag('a', {
      name: 'Bravo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await seedTag('b', {
      name: 'Alpha',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    expect(
      (await service.getTagsByStoryId(TEST_STORY_ID, undefined, undefined, 'name', 'asc')).map(
        (tag) => tag.id,
      ),
    ).toEqual(['b', 'a']);
    expect(
      (
        await service.getTagsByStoryId(TEST_STORY_ID, undefined, undefined, 'createdAt', 'desc')
      ).map((tag) => tag.id),
    ).toEqual(['b', 'a']);
    expect(
      (await service.getTagsByStoryId(TEST_STORY_ID, undefined, undefined, 'updatedAt', 'asc')).map(
        (tag) => tag.id,
      ),
    ).toEqual(['b', 'a']);
    expect(
      (await service.getTagsByStoryId(TEST_STORY_ID, undefined, undefined, 'nope', 'asc')).map(
        (tag) => tag.id,
      ),
    ).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: nope');
  });

  it('orders by name when no sort is requested', async () => {
    const service = createTagService(database.db);
    await seedTag('a', { name: 'Bravo' });
    await seedTag('b', { name: 'Alpha' });

    expect((await service.getTagsByStoryId(TEST_STORY_ID)).map((tag) => tag.id)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('TagService mutation edges', () => {
  it('refuses to update a tag that does not exist', async () => {
    const service = createTagService(database.db);

    await expect(service.updateTag(TEST_USER_ID, 'missing', { name: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('skips the write and the operation log when nothing changed', async () => {
    const service = createTagService(database.db);
    await seedTag('a', { name: 'Crew' });

    await service.updateTag(TEST_USER_ID, 'a', { name: 'Crew' });

    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('ignores a delete for a tag that does not exist', async () => {
    const service = createTagService(database.db);

    await service.deleteTag(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent tag missing.');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});
