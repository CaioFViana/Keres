/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import {
  LIST_CATALOG_TYPE,
  createSuggestionService,
  namedListDisplayKey,
} from '../../src/services/storymanagement/SuggestionService';
import {
  customAttributeSuggestionType,
  parseNamedListCatalogValue,
} from '../../src/services/storymanagement/suggestionTypes';
import { entityBase, TEST_STORY_ID, TEST_USER_ID, seedLocalStory } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('named suggestion lists', () => {
  it('creates a list catalog entry with type list_<id>_<slug> and keeps an empty list', async () => {
    const service = createSuggestionService(database.db);
    const created = await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Cores');

    expect(created.name).toBe('Cores');
    expect(created.type).toMatch(/^list_[0-9A-HJKMNP-TV-Z]{26}_cores$/);
    expect(namedListDisplayKey(created.type)).toBe('cores');
    expect(await service.listNamedLists(TEST_STORY_ID)).toEqual([created]);
    expect(await service.getStoredSuggestions(created.type, TEST_STORY_ID)).toEqual([]);
    expect(await service.getStoredSuggestions(LIST_CATALOG_TYPE, TEST_STORY_ID)).toHaveLength(1);
  });

  it('copies stored values into other lists and skips duplicates', async () => {
    const service = createSuggestionService(database.db);
    const colors = await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Cores');
    await service.createSuggestion(TEST_USER_ID, colors.type, 'Vermelho', TEST_STORY_ID);
    await service.createSuggestion(TEST_USER_ID, colors.type, 'Azul', TEST_STORY_ID);
    await service.createSuggestion(TEST_USER_ID, 'character_race', 'Azul', TEST_STORY_ID);

    const result = await service.copyStoredValues(TEST_USER_ID, TEST_STORY_ID, colors.type, [
      'character_race',
      colors.type,
      LIST_CATALOG_TYPE,
    ]);

    expect(result).toEqual({ copied: 1, skipped: 1 });
    const races = (await service.getStoredSuggestions('character_race', TEST_STORY_ID)).map(
      (row) => row.value,
    );
    expect(races.sort()).toEqual(['Azul', 'Vermelho']);
  });

  it('does not copy live native values that were never stored', async () => {
    const service = createSuggestionService(database.db);
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: TEST_STORY_ID,
      name: 'Ada',
      gender: 'Feminino',
      ...entityBase,
    });
    const colors = await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Cores');

    const result = await service.copyStoredValues(TEST_USER_ID, TEST_STORY_ID, 'character_gender', [
      colors.type,
    ]);

    expect(result).toEqual({ copied: 0, skipped: 0 });
    expect(await service.getStoredSuggestions(colors.type, TEST_STORY_ID)).toEqual([]);
  });

  it('renames the catalog display name without changing type or items', async () => {
    const service = createSuggestionService(database.db);
    const colors = await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Cores');
    await service.createSuggestion(TEST_USER_ID, colors.type, 'Verde', TEST_STORY_ID);

    const renamed = await service.renameNamedList(TEST_USER_ID, TEST_STORY_ID, colors.type, 'Tons');

    expect(renamed).toEqual({ type: colors.type, name: 'Tons' });
    expect(namedListDisplayKey(renamed.type)).toBe('cores');
    expect(await service.listNamedLists(TEST_STORY_ID)).toEqual([renamed]);
    expect(
      (await service.getStoredSuggestions(colors.type, TEST_STORY_ID)).map((row) => row.value),
    ).toEqual(['Verde']);
  });

  it('deletes a named list and its catalog row', async () => {
    const service = createSuggestionService(database.db);
    const colors = await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Cores');
    await service.createSuggestion(TEST_USER_ID, colors.type, 'Verde', TEST_STORY_ID);

    await service.deleteNamedList(TEST_USER_ID, TEST_STORY_ID, colors.type);

    expect(await service.listNamedLists(TEST_STORY_ID)).toEqual([]);
    expect(await service.getStoredSuggestions(colors.type, TEST_STORY_ID)).toEqual([]);
  });

  it('lists named lists ordered by display name, skipping corrupt catalog rows', async () => {
    const service = createSuggestionService(database.db);
    await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Zebras');
    await service.createNamedList(TEST_USER_ID, TEST_STORY_ID, 'Cores');
    await service.createSuggestion(TEST_USER_ID, LIST_CATALOG_TYPE, 'not-json{{{', TEST_STORY_ID);

    expect((await service.listNamedLists(TEST_STORY_ID)).map((list) => list.name)).toEqual([
      'Cores',
      'Zebras',
    ]);
  });

  it('returns no usages for an unknown suggestion type', async () => {
    const service = createSuggestionService(database.db);

    expect(await service.getSuggestions('no-such-type', TEST_STORY_ID)).toEqual([]);
    expect(await service.getSuggestions('character_race', '')).toEqual([]);
  });

  it('refuses to create a suggestion without type, value or story', async () => {
    const service = createSuggestionService(database.db);

    await expect(
      service.createSuggestion(TEST_USER_ID, 'character_race', '   ', TEST_STORY_ID),
    ).rejects.toThrow('required');
  });

  it('merges a rename into an existing saved value by deleting the source row', async () => {
    const service = createSuggestionService(database.db);
    await service.createSuggestion(TEST_USER_ID, 'character_race', 'Elf', TEST_STORY_ID);
    await service.createSuggestion(TEST_USER_ID, 'character_race', 'Dwarf', TEST_STORY_ID);

    const result = await service.renameSuggestionValue(
      TEST_USER_ID,
      TEST_STORY_ID,
      'character_race',
      'Elf',
      'Dwarf',
      true,
    );

    expect(result.merged).toBe(true);
    expect(
      (await service.getStoredSuggestions('character_race', TEST_STORY_ID)).map((row) => row.value),
    ).toEqual(['Dwarf']);
  });

  it('refuses to copy from the list catalog itself', async () => {
    const service = createSuggestionService(database.db);

    await expect(
      service.copyStoredValues(TEST_USER_ID, TEST_STORY_ID, LIST_CATALOG_TYPE, ['character_race']),
    ).rejects.toThrow('Cannot copy from the list catalog.');
  });

  it('derives catalog keys and display names, tolerating corrupt entries', async () => {
    expect(customAttributeSuggestionType('field-9')).toBe('custom:field-9');
    expect(namedListDisplayKey('list_01J9GQK7X1D6N3Q2R4W5E6T7Y1_cores')).toBe('cores');
    // A hand-written catalog type without the ULID slug still lists under its full key.
    expect(namedListDisplayKey('list_x9_cores')).toBe('list_x9_cores');
    expect(parseNamedListCatalogValue('not-json{{{')).toBeNull();
    expect(parseNamedListCatalogValue(JSON.stringify({ type: 'character_race' }))).toBeNull();
    expect(
      parseNamedListCatalogValue(
        JSON.stringify({ type: 'list_01J9GQK7X1D6N3Q2R4W5E6T7Y1_cores', name: '  Cores ' }),
      ),
    ).toEqual({ type: 'list_01J9GQK7X1D6N3Q2R4W5E6T7Y1_cores', name: 'Cores' });
  });
});
