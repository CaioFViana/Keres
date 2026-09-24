/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createFavoriteService } from '../../src/services/storymanagement/FavoriteService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
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

describe('FavoriteService', () => {
  it('keeps individual favorites private and restores the same tombstone when re-favorited', async () => {
    const service = createFavoriteService(database.db);

    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, true);
    expect(
      await service.isFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, false),
    ).toBe(true);
    expect(
      await service.decorateEntities(TEST_STORY_ID, 'Character', TEST_USER_ID, [
        { id: 'char-1', isFavorite: false },
        { id: 'char-2', isFavorite: true },
      ]),
    ).toEqual([
      { id: 'char-1', isFavorite: true },
      { id: 'char-2', isFavorite: false },
    ]);

    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, false);
    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, true);
    expect(await database.db.select().from(schema.favorites).all()).toEqual([
      expect.objectContaining({ isDeleted: false, version: 3 }),
    ]);
  });

  it('resolves the author identity through the linked server account', async () => {
    await database.db.insert(schema.servers).values({
      id: 'server-1',
      idUser: 'server-user',
      userName: 'owner',
      name: 'Home',
      url: 'https://home.example',
      ...entityBase,
      deletedAt: null,
    });
    await database.db
      .update(schema.stories)
      // A linked story with an unresolved role refuses writes, so the role is set: what this
      // test pins is the identity keying, not the unresolved window.
      .set({ serverId: 'server-1', myRole: 'owner' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    const service = createFavoriteService(database.db);

    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, true);

    // The row is keyed by the server account, not the local device user, so every device of
    // the same account reads the same favorite.
    expect(await database.db.select().from(schema.favorites).all()).toEqual([
      expect.objectContaining({ userId: 'server-user' }),
    ]);
    expect(
      await service.isFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, false),
    ).toBe(true);
  });

  it('lists the favoriters only under public behavior', async () => {
    const service = createFavoriteService(database.db);
    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, true);

    expect(await service.getFavoriterIds(TEST_STORY_ID, 'char-1', 'Character')).toEqual([]);

    await database.db
      .update(schema.stories)
      .set({ favoriteBehavior: 'individual_public' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    expect(await service.getFavoriterIds(TEST_STORY_ID, 'char-1', 'Character')).toEqual([
      TEST_USER_ID,
    ]);
  });

  it('merges favorite rows when migrating identities instead of duplicating them', async () => {
    const service = createFavoriteService(database.db);
    // A live source row with a tombstoned target: the target is revived, the source dropped.
    await database.db.insert(schema.favorites).values([
      {
        id: 'fav-source',
        storyId: TEST_STORY_ID,
        entityId: 'char-1',
        entityType: 'Character',
        userId: 'old-user',
        ...entityBase,
      },
      {
        id: 'fav-target',
        storyId: TEST_STORY_ID,
        entityId: 'char-1',
        entityType: 'Character',
        userId: 'new-user',
        ...entityBase,
        isDeleted: true,
      },
      // A tombstoned source row with a live target: the source is simply dropped.
      {
        id: 'fav-source-dead',
        storyId: TEST_STORY_ID,
        entityId: 'char-2',
        entityType: 'Character',
        userId: 'old-user',
        ...entityBase,
        isDeleted: true,
      },
      {
        id: 'fav-target-live',
        storyId: TEST_STORY_ID,
        entityId: 'char-2',
        entityType: 'Character',
        userId: 'new-user',
        ...entityBase,
      },
    ]);

    await service.migrateUserIdentity(TEST_STORY_ID, 'old-user', 'new-user');

    const rows = await database.db.select().from(schema.favorites).all();
    expect(rows.map((row) => [row.id, row.userId, row.isDeleted]).sort()).toEqual([
      ['fav-target', 'new-user', false],
      ['fav-target-live', 'new-user', false],
    ]);
  });
});
