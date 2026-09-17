/** @jest-environment node */
import * as schema from '../../src/db/schema';
import { useCharacterStore } from '../../src/state/characterStore';
import { useGalleryStore } from '../../src/state/galleryStore';
import { useItemStore } from '../../src/state/itemStore';
import { useLocationStore } from '../../src/state/locationStore';
import { useNoteStore } from '../../src/state/noteStore';
import { resetAllClientStores } from '../../src/state/resetAllClientStores';
import { useTagStore } from '../../src/state/tagStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { useWorldRuleStore } from '../../src/state/worldRuleStore';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The thin entity stores' wiring: each one is a `createEntityStore` configuration whose only own
 * code is the fetch call and the favorite write. The factory suite covers the shared machinery;
 * this loop proves every store actually points at its own service method in both directions -
 * a copy-paste slip here would show one entity's rows under another entity's tab.
 *
 * The story uses the global favorite behavior so the toggle goes through the store's own
 * `updateFavorite` instead of the per-user favorites table.
 */

let database: TestDatabase;

const seeders: Record<string, () => Promise<void>> = {
  characters: () =>
    database.db
      .insert(schema.characters)
      .values({ id: 'row-1', storyId: TEST_STORY_ID, name: 'Ada', ...entityBase })
      .then(() => undefined),
  galleries: () =>
    database.db
      .insert(schema.galleries)
      .values({
        id: 'row-1',
        storyId: TEST_STORY_ID,
        mediaType: 'image',
        mimeType: 'image/png',
        fileName: 'map.png',
        hash: 'hash-1',
        sizeBytes: 10,
        ...entityBase,
      })
      .then(() => undefined),
  items: () =>
    database.db
      .insert(schema.items)
      .values({
        id: 'row-1',
        storyId: TEST_STORY_ID,
        name: 'Compass',
        ...entityBase,
        deletedAt: null,
      })
      .then(() => undefined),
  locations: () =>
    database.db
      .insert(schema.locations)
      .values({
        id: 'row-1',
        storyId: TEST_STORY_ID,
        name: 'Harbor',
        ...entityBase,
        deletedAt: null,
      })
      .then(() => undefined),
  notes: () =>
    database.db
      .insert(schema.notes)
      .values({
        id: 'row-1',
        storyId: TEST_STORY_ID,
        title: 'Dues',
        ...entityBase,
        deletedAt: null,
      })
      .then(() => undefined),
  tags: () =>
    database.db
      .insert(schema.tags)
      .values({
        id: 'row-1',
        storyId: TEST_STORY_ID,
        name: 'Crew',
        ...entityBase,
        deletedAt: null,
      })
      .then(() => undefined),
  worldRules: () =>
    database.db
      .insert(schema.worldRules)
      .values({
        id: 'row-1',
        storyId: TEST_STORY_ID,
        title: 'No iron',
        ...entityBase,
        deletedAt: null,
      })
      .then(() => undefined),
};

const stores = [
  ['characters', useCharacterStore, 'fetchCharacters'],
  ['galleries', useGalleryStore, 'fetchGalleries'],
  ['items', useItemStore, 'fetchItems'],
  ['locations', useLocationStore, 'fetchLocations'],
  ['notes', useNoteStore, 'fetchNotes'],
  ['tags', useTagStore, 'fetchTags'],
  ['worldRules', useWorldRuleStore, 'fetchWorldRules'],
] as const;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database, { favoriteBehavior: 'global' });
  resetAllClientStores();
  useUserSettingsStore.setState({ userId: TEST_USER_ID });
});

afterEach(() => {
  resetAllClientStores();
  useUserSettingsStore.setState({ userId: null });
  database.close();
});

describe.each(stores)('%s store', (collectionKey, store, fetchKey) => {
  it('fetches its own rows and persists a favorite toggle through its own service', async () => {
    await seeders[collectionKey]!();
    store.getState().setDbAndStoryId(database.db, TEST_STORY_ID);
    store.getState().initializeService();

    await (store.getState() as unknown as Record<string, () => Promise<void>>)[fetchKey]();

    const rows = (store.getState() as unknown as Record<string, Array<{ id: string }>>)[
      collectionKey
    ];
    expect(rows.map((row) => row.id)).toEqual(['row-1']);

    await store.getState().toggleFavorite('row-1', true);

    const updated = (store.getState() as unknown as Record<string, Array<{ isFavorite: boolean }>>)[
      collectionKey
    ];
    expect(updated[0]?.isFavorite).toBe(true);
  });
});
