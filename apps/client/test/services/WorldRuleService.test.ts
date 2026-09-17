/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createWorldRuleService } from '../../src/services/storymanagement/WorldRuleService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The world-rule service's listing, tag grouping and mutation edges.
 *
 * World rules share the tagged-list shape with notes (pre-filter by tag ids, then a guarded join),
 * including the early `[]` when no live rule carries the tag. The pinned behaviours are the title
 * search, the tag grouping that skips tombstoned tags, and the quiet edges a stale screen hits:
 * updating or deleting an id that is gone, and saving a form that changed nothing.
 *
 * Two throws are deliberately not covered: the "failed to retrieve the row we just wrote" guards in
 * `updateWorldRule`/`deleteWorldRule`, which need the row to vanish between two statements of the
 * same call.
 */

let database: TestDatabase;

const seedRule = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.worldRules).values({
    id,
    storyId: TEST_STORY_ID,
    title: `Rule ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

const seedTaggedRule = async (ruleId: string, tagId: string): Promise<void> => {
  await database.db.insert(schema.tags).values({
    id: tagId,
    storyId: TEST_STORY_ID,
    name: `Tag ${tagId}`,
    ...entityBase,
  });
  await database.db.insert(schema.tagRelations).values({
    id: `rel-${ruleId}-${tagId}`,
    storyId: TEST_STORY_ID,
    tagId,
    relationId: ruleId,
    relationType: 'WorldRule',
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

describe('WorldRuleService listing', () => {
  it('matches the search term against the title case-insensitively', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', { title: 'No iron after dark' });
    await seedRule('b', { title: 'Pay the ferryman' });

    expect(
      (await service.getWorldRulesByStoryId(TEST_STORY_ID, 'IRON')).map((rule) => rule.id),
    ).toEqual(['a']);
  });

  it('filters by tags and returns nothing when no rule carries them', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a');
    await seedRule('b');
    await seedTaggedRule('a', 't-magic');

    expect(
      (await service.getWorldRulesByStoryId(TEST_STORY_ID, undefined, ['t-magic'])).map(
        (rule) => rule.id,
      ),
    ).toEqual(['a']);
    expect(await service.getWorldRulesByStoryId(TEST_STORY_ID, undefined, ['t-missing'])).toEqual(
      [],
    );
  });

  it('filters by favorite state in both directions', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', { isFavorite: true });
    await seedRule('b', { isFavorite: false });

    expect(
      (
        await service.getWorldRulesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          null,
          'asc',
          'favorite',
        )
      ).map((rule) => rule.id),
    ).toEqual(['a']);
    expect(
      (
        await service.getWorldRulesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          null,
          'asc',
          'not-favorite',
        )
      ).map((rule) => rule.id),
    ).toEqual(['b']);
  });

  it('sorts by title and timestamps, and warns on an unknown key', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', {
      title: 'Bravo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await seedRule('b', {
      title: 'Alpha',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    expect(
      (
        await service.getWorldRulesByStoryId(TEST_STORY_ID, undefined, undefined, 'title', 'asc')
      ).map((rule) => rule.id),
    ).toEqual(['b', 'a']);
    expect(
      (
        await service.getWorldRulesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          'createdAt',
          'desc',
        )
      ).map((rule) => rule.id),
    ).toEqual(['b', 'a']);
    expect(
      (
        await service.getWorldRulesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          'updatedAt',
          'asc',
        )
      ).map((rule) => rule.id),
    ).toEqual(['b', 'a']);
    expect(
      (
        await service.getWorldRulesByStoryId(TEST_STORY_ID, undefined, undefined, 'nope', 'asc')
      ).map((rule) => rule.id),
    ).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: nope');
  });

  it('orders by title when no sort is requested', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', { title: 'Bravo' });
    await seedRule('b', { title: 'Alpha' });

    expect((await service.getWorldRulesByStoryId(TEST_STORY_ID)).map((rule) => rule.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('groups each rule with its live tags only', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a');
    await seedTaggedRule('a', 't-live');
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
      relationType: 'WorldRule',
      ...entityBase,
      deletedAt: null,
    });

    const rows = await service.getWorldRulesByStoryId(TEST_STORY_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags.map((tag) => tag.id)).toEqual(['t-live']);
  });

  it('narrows by advanced criteria', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', { title: 'No iron after dark' });
    await seedRule('b', { title: 'Pay the ferryman' });

    const rows = await service.getWorldRulesByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      null,
      'asc',
      'all',
      { title: 'ferryman' },
    );

    expect(rows.map((rule) => rule.id)).toEqual(['b']);
  });
});

describe('WorldRuleService getById', () => {
  it('returns the rule with its tags attached', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', { title: 'No iron after dark' });
    await seedTaggedRule('a', 't-magic');

    const found = await service.getById('a');

    expect(found).toMatchObject({ id: 'a', title: 'No iron after dark' });
    expect(found?.tags.map((tag) => tag.id)).toEqual(['t-magic']);
  });

  it('returns undefined for a missing or deleted rule', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('gone', { isDeleted: true });

    expect(await service.getById('missing')).toBeUndefined();
    expect(await service.getById('gone')).toBeUndefined();
  });
});

describe('WorldRuleService mutation edges', () => {
  it('refuses to update a rule that does not exist', async () => {
    const service = createWorldRuleService(database.db);

    await expect(service.updateWorldRule(TEST_USER_ID, 'missing', { title: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('skips the write and the operation log when nothing changed', async () => {
    const service = createWorldRuleService(database.db);
    await seedRule('a', { title: 'No iron after dark' });

    const result = await service.updateWorldRule(TEST_USER_ID, 'a', {
      title: 'No iron after dark',
    });

    expect(result.title).toBe('No iron after dark');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('ignores a delete for a rule that does not exist', async () => {
    const service = createWorldRuleService(database.db);

    await service.deleteWorldRule(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith(
      'Attempted to delete non-existent world rule missing.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});
