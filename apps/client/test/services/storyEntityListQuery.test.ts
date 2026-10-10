/**
 * @jest-environment node
 */
import { and, asc, desc } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  applyKeyedListSort,
  applyListSort,
  storyEntityConditions,
} from '../../src/services/storymanagement/storyEntityListQuery';
import { entityBase, seedLocalStory, TEST_NOW, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The shared list pieces that the story entity services build their queries from: the scope to one
 * story, the live rows, the search term, the favourite filter, and the two sort helpers. The
 * services are covered by their own tests; these pin the helpers directly against sqlite.
 */

const OTHER_STORY_ID = 'story-other';

let database: TestDatabase;

const seedItem = async (
  id: string,
  overrides: Record<string, unknown> = {},
  storyId: string = TEST_STORY_ID,
): Promise<void> => {
  await database.db.insert(schema.items).values({
    id,
    storyId,
    name: `Item ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

/** Runs the shared conditions and the named sort over items; returns the ids in result order. */
const listItemIds = async (
  options: { searchTerm?: string; favoriteFilterState?: 'all' | 'favorite' | 'not-favorite' } = {},
  sortBy?: string,
  sortDirection?: 'asc' | 'desc',
  storyId: string = TEST_STORY_ID,
): Promise<string[]> => {
  const query = database.db
    .select()
    .from(schema.items)
    .where(
      and(
        ...storyEntityConditions(schema.items, storyId, {
          searchColumn: schema.items.name,
          ...options,
        }),
      ),
    )
    .$dynamic();
  const rows = await applyListSort(query, schema.items, sortBy, sortDirection).all();
  return rows.map((row) => row.id);
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedLocalStory(database, { id: OTHER_STORY_ID, title: 'Another story' });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('storyEntityConditions', () => {
  it('matches the search term case-insensitively', async () => {
    await seedItem('a', { name: 'Brass Compass' });
    await seedItem('b', { name: 'Coil of rope' });

    expect(await listItemIds({ searchTerm: 'compass' })).toEqual(['a']);
    expect(await listItemIds({ searchTerm: 'COIL' })).toEqual(['b']);
  });

  it('keeps only favourites for "favorite" and only the others for "not-favorite"', async () => {
    await seedItem('fav', { isFavorite: true });
    await seedItem('plain', { isFavorite: false });

    expect(await listItemIds({ favoriteFilterState: 'favorite' })).toEqual(['fav']);
    expect(await listItemIds({ favoriteFilterState: 'not-favorite' })).toEqual(['plain']);
    expect((await listItemIds({ favoriteFilterState: 'all' })).sort()).toEqual(['fav', 'plain']);
  });

  it('leaves out soft-deleted rows', async () => {
    await seedItem('live');
    await seedItem('gone', { isDeleted: true, deletedAt: TEST_NOW });

    expect(await listItemIds()).toEqual(['live']);
  });

  it('leaves out rows of other stories', async () => {
    await seedItem('mine');
    await seedItem('theirs', {}, OTHER_STORY_ID);

    expect(await listItemIds()).toEqual(['mine']);
    expect(await listItemIds({}, undefined, undefined, OTHER_STORY_ID)).toEqual(['theirs']);
  });

  it('matches a search over several columns when given an array of them', async () => {
    await database.db.insert(schema.locations).values([
      { id: 'l1', storyId: TEST_STORY_ID, name: 'Harbour', description: 'Old pier', ...entityBase },
      {
        id: 'l2',
        storyId: TEST_STORY_ID,
        name: 'Mill',
        description: 'by the HARBOUR wall',
        ...entityBase,
      },
      { id: 'l3', storyId: TEST_STORY_ID, name: 'Forest', description: 'Deep', ...entityBase },
    ]);

    const query = database.db
      .select()
      .from(schema.locations)
      .where(
        and(
          ...storyEntityConditions(schema.locations, TEST_STORY_ID, {
            searchColumn: [schema.locations.name, schema.locations.description],
            searchTerm: 'harbour',
          }),
        ),
      )
      .$dynamic();
    const rows = await applyListSort(query, schema.locations, 'name', 'asc').all();

    expect(rows.map((row) => row.id)).toEqual(['l1', 'l2']);
  });

  it('refuses a favourite filter on a table that has no favourite column', () => {
    expect(() =>
      storyEntityConditions(schema.choices, TEST_STORY_ID, {
        searchColumn: schema.choices.text,
        favoriteFilterState: 'favorite',
      }),
    ).toThrow('no isFavorite column');
  });
});

describe('applyListSort', () => {
  it('orders by creation time when no sort is named', async () => {
    await seedItem('late', { createdAt: new Date('2026-08-15T00:00:00.000Z') });
    await seedItem('early', { createdAt: new Date('2026-08-01T00:00:00.000Z') });

    expect(await listItemIds()).toEqual(['early', 'late']);
  });

  it('sorts by a named column ascending and descending', async () => {
    await seedItem('a', { name: 'Apple' });
    await seedItem('b', { name: 'Banana' });
    await seedItem('c', { name: 'Cherry' });

    expect(await listItemIds({}, 'name', 'asc')).toEqual(['a', 'b', 'c']);
    expect(await listItemIds({}, 'name', 'desc')).toEqual(['c', 'b', 'a']);
  });

  it('warns about an unknown sort key and applies no order', async () => {
    await seedItem('a', { name: 'Apple' });
    await seedItem('b', { name: 'Banana' });

    const ids = await listItemIds({}, 'bogus');

    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: bogus');
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});

describe('applyKeyedListSort', () => {
  const sortItems = async (
    sortBy: string | undefined,
    sortDirection: 'asc' | 'desc' | undefined,
    leadingOrder: Parameters<typeof applyKeyedListSort>[5] = [],
  ): Promise<string[]> => {
    const query = database.db
      .select()
      .from(schema.items)
      .where(
        and(
          ...storyEntityConditions(schema.items, TEST_STORY_ID, {
            searchColumn: schema.items.name,
          }),
        ),
      )
      .$dynamic();
    const sorted = applyKeyedListSort(
      query,
      sortBy,
      sortDirection,
      { name: schema.items.name, createdAt: schema.items.createdAt },
      schema.items.name,
      leadingOrder,
    );
    return (await sorted.all()).map((row) => row.id);
  };

  it('sorts by a listed column in the given direction', async () => {
    await seedItem('a', { name: 'Apple' });
    await seedItem('b', { name: 'Banana' });

    expect(await sortItems('name', 'desc')).toEqual(['b', 'a']);
  });

  it('defaults to the default column ascending when no sort is named', async () => {
    await seedItem('b', { name: 'Banana' });
    await seedItem('a', { name: 'Apple' });

    expect(await sortItems(undefined, undefined)).toEqual(['a', 'b']);
  });

  it('warns about a name that is not listed, prototype names included', async () => {
    await seedItem('a', { name: 'Apple' });

    const ids = await sortItems('constructor', 'asc');

    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: constructor');
    expect(ids).toEqual(['a']);
  });

  it('puts the leading order ahead of the named sort', async () => {
    await seedItem('brass', { name: 'Brass', isFavorite: false });
    await seedItem('coil', { name: 'Coil', isFavorite: true });
    await seedItem('anchor', { name: 'Anchor', isFavorite: false });

    expect(await sortItems('name', 'asc', [desc(schema.items.isFavorite)])).toEqual([
      'coil',
      'anchor',
      'brass',
    ]);
  });

  it('keeps the leading order as the only order when no sort is named', async () => {
    await seedItem('coil', { name: 'Coil', createdAt: new Date('2026-08-02T00:00:00.000Z') });
    await seedItem('brass', { name: 'Brass', createdAt: new Date('2026-08-01T00:00:00.000Z') });

    expect(await sortItems(undefined, undefined, [asc(schema.items.createdAt)])).toEqual([
      'brass',
      'coil',
    ]);
  });
});
