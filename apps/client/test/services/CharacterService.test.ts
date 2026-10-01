/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The character service's listing, advanced relation search and mutation edges.
 *
 * Beyond the shared list shape (tag join, favorite filter, sort switch) the character list has
 * one search no sibling has: `relationType`, an `EXISTS` subquery over the character-relations
 * table. It answers "who has a mentor?" - and because it is raw SQL with the story id inlined as
 * a parameter, it needs a test proving it scopes to this story and skips tombstoned relations.
 *
 * Three paths are deliberately not covered: the "failed to retrieve the row we just wrote" throws
 * in update/delete, and the catch in `getAllByStoryId`, which needs the database itself to fail.
 */

let database: TestDatabase;

const seedCharacter = async (
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<void> => {
  await database.db.insert(schema.characters).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Person ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

const seedRelation = async (
  id: string,
  character1Id: string,
  character2Id: string,
  relationType: string,
  storyId: string = TEST_STORY_ID,
): Promise<void> => {
  await database.db.insert(schema.characterRelations).values({
    id,
    storyId,
    character1Id,
    character2Id,
    relationType,
    ...entityBase,
    deletedAt: null,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('CharacterService listing', () => {
  it('filters by tags of characters only', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada');
    await seedCharacter('grace');
    await database.db.insert(schema.tags).values({
      id: 't-crew',
      storyId: TEST_STORY_ID,
      name: 'Crew',
      ...entityBase,
    });
    await database.db.insert(schema.tagRelations).values({
      id: 'r1',
      storyId: TEST_STORY_ID,
      tagId: 't-crew',
      relationId: 'ada',
      relationType: 'Character',
      ...entityBase,
      deletedAt: null,
    });

    const rows = await service.getCharactersByStoryId(TEST_STORY_ID, undefined, ['t-crew']);

    expect(rows.map((row) => row.id)).toEqual(['ada']);
    expect(rows[0]?.tags.map((tag) => tag.id)).toEqual(['t-crew']);
  });

  it('drops deleted tags from the grouping', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada');
    await database.db.insert(schema.tags).values({
      id: 't-gone',
      storyId: TEST_STORY_ID,
      name: 'Gone',
      ...entityBase,
      isDeleted: true,
    });
    await database.db.insert(schema.tagRelations).values({
      id: 'r1',
      storyId: TEST_STORY_ID,
      tagId: 't-gone',
      relationId: 'ada',
      relationType: 'Character',
      ...entityBase,
      deletedAt: null,
    });

    const rows = await service.getCharactersByStoryId(TEST_STORY_ID);

    expect(rows[0]?.tags).toEqual([]);
  });

  it('excludes non-favorites on request', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada', { isFavorite: true });
    await seedCharacter('grace', { isFavorite: false });

    expect(
      (
        await service.getCharactersByStoryId(TEST_STORY_ID, undefined, undefined, 'not-favorite')
      ).map((row) => row.id),
    ).toEqual(['grace']);
  });

  it('sorts by name and timestamps in both directions', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('a', {
      name: 'Bravo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await seedCharacter('b', {
      name: 'Alpha',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    const byName = await service.getCharactersByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'name',
      'desc',
    );
    expect(byName.map((row) => row.id)).toEqual(['a', 'b']);
    const byCreated = await service.getCharactersByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'createdAt',
      'asc',
    );
    expect(byCreated.map((row) => row.id)).toEqual(['a', 'b']);
    const byUpdated = await service.getCharactersByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      'updatedAt',
      'desc',
    );
    expect(byUpdated.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('finds characters by relation type from either side of the pair', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada');
    await seedCharacter('grace');
    await seedCharacter('hopper');
    await seedRelation('rel-1', 'ada', 'grace', 'mentor');
    await seedRelation('rel-2', 'hopper', 'grace', 'sibling');

    const rows = await service.getCharactersByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      undefined,
      'asc',
      { relationType: 'ment' },
    );

    expect(rows.map((row) => row.id).sort()).toEqual(['ada', 'grace']);
  });

  it('scopes the relation search to this story and to live relations', async () => {
    const service = createCharacterService(database.db);
    await seedLocalStory(database, { id: 'other-story', title: 'Other' });
    await seedCharacter('ada');
    await seedCharacter('grace');
    await seedRelation('rel-other', 'ada', 'grace', 'mentor', 'other-story');
    await database.db.insert(schema.characterRelations).values({
      id: 'rel-dead',
      storyId: TEST_STORY_ID,
      character1Id: 'ada',
      character2Id: 'grace',
      relationType: 'mentor',
      ...entityBase,
      isDeleted: true,
      deletedAt: null,
    });

    const rows = await service.getCharactersByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      undefined,
      'asc',
      { relationType: 'mentor' },
    );

    expect(rows).toEqual([]);
  });

  it('ignores an empty relation-type criterion and warns on a field without metadata', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada');

    const rows = await service.getCharactersByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      'all',
      undefined,
      'asc',
      { relationType: '', noSuchField: 'x' },
    );

    expect(rows.map((row) => row.id)).toEqual(['ada']);
    expect(console.warn).toHaveBeenCalledWith(
      'No metadata found for advanced search field: noSuchField',
    );
  });

  it('returns an empty list when the story id is missing', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada');

    expect(await service.getAllByStoryId('')).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('getAllByStoryId: storyId is required.');
    expect((await service.getAllByStoryId(TEST_STORY_ID)).map((row) => row.id)).toEqual(['ada']);
  });
});

describe('CharacterService mutation edges', () => {
  it('refuses to update a character that does not exist', async () => {
    const service = createCharacterService(database.db);

    await expect(service.updateCharacter(TEST_USER_ID, 'missing', { name: 'X' })).rejects.toThrow(
      'not found for update',
    );
  });

  it('skips the write and the operation log when nothing changed', async () => {
    const service = createCharacterService(database.db);
    await seedCharacter('ada', { name: 'Ada' });

    const result = await service.updateCharacter(TEST_USER_ID, 'ada', { name: 'Ada' });

    expect(result.name).toBe('Ada');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('ignores a delete for a character that does not exist', async () => {
    const service = createCharacterService(database.db);

    await service.deleteCharacter(TEST_USER_ID, 'missing');

    expect(console.warn).toHaveBeenCalledWith(
      'Attempted to delete non-existent character missing.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});
