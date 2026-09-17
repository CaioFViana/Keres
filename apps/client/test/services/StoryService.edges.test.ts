/** @jest-environment node */
jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));

import axios from 'axios';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createLocationMapService } from '../../src/services/storymanagement/LocationMapService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The story service's edges: the not-found guards, the favorite reroute, plot counting, and the
 * server-notification paths of delete and unlink.
 *
 * Lifecycle, conversion and transfer already have their suites (`StoryService.lifecycle`,
 * `.policy`, `.transfer`, `storyTypeConversion`). What was missing is the quiet side: deleting or
 * unlinking an unknown id, unlinking a story that is already local, and the best-effort server
 * notification on delete - which warns and purges locally even when the server answers with a
 * conflict. HTTP is intercepted at `axios.defaults.adapter`, so the singleton's interceptors run
 * untouched.
 *
 * Two throws are deliberately not covered: the "the write returned no row" guards on the favorite
 * and update paths, which need the row to vanish between two statements of the same call.
 */

let database: TestDatabase;

const linkStoryToServer = async (storyId: string, serverId: string): Promise<void> => {
  await database.db.insert(schema.servers).values({
    id: serverId,
    idUser: 'server-user',
    userName: 'owner',
    name: 'Home server',
    url: 'https://home.example',
    ...entityBase,
    deletedAt: null,
  });
  await database.db
    .update(schema.stories)
    .set({ serverId, myRole: 'owner' })
    .where(eq(schema.stories.id, storyId));
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete (axios.defaults as { adapter?: unknown }).adapter;
  database.close();
  jest.restoreAllMocks();
});

describe('StoryService guards', () => {
  it('refuses to update, favorite, convert or unlink a story that does not exist', async () => {
    const service = createStoryService(database.db);

    await expect(service.updateStory(TEST_USER_ID, 'missing', { title: 'X' })).rejects.toThrow(
      'not found',
    );
    await expect(service.updateStoryFavoriteStatus(TEST_USER_ID, 'missing', true)).rejects.toThrow(
      'not found',
    );
    await expect(service.convertStoryType(TEST_USER_ID, 'missing', 'branching')).rejects.toThrow(
      'not found',
    );
    await expect(service.unlinkFromServer(TEST_USER_ID, 'missing')).rejects.toThrow('not found');
  });

  it('warns and stays quiet when deleting a story that does not exist', async () => {
    await createStoryService(database.db).deleteStory('missing');

    expect(console.warn).toHaveBeenCalledWith('Attempted to delete non-existent story missing.');
  });

  it('does nothing when converting to the type the story already has', async () => {
    const service = createStoryService(database.db);

    await service.convertStoryType(TEST_USER_ID, TEST_STORY_ID, 'linear');

    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
    expect(await service.getStoryById(TEST_STORY_ID)).toMatchObject({ type: 'linear' });
  });
});

describe('StoryService favorites and plots', () => {
  it('routes a story favorite through the favorites table under individual behavior', async () => {
    const service = createStoryService(database.db);

    await service.updateStory(TEST_USER_ID, TEST_STORY_ID, { isFavorite: true });

    // The column stays false: the marker lives in the favorites table, and no Story-row
    // update is logged for a change that never touched the row - only the Favorite's own create.
    expect(await service.getStoryById(TEST_STORY_ID)).toMatchObject({ isFavorite: false });
    const favorites = await database.db.query.favorites.findMany();
    expect(favorites).toHaveLength(1);
    expect(favorites[0]).toMatchObject({
      entityType: 'Story',
      entityId: TEST_STORY_ID,
      userId: TEST_USER_ID,
    });
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entityType: 'Favorite', operationType: 'create' });
  });

  it('counts only the live plots of the story', async () => {
    const service = createStoryService(database.db);
    await database.db.insert(schema.plots).values([
      { id: 'plot-1', storyId: TEST_STORY_ID, name: 'One', ...entityBase, deletedAt: null },
      {
        id: 'plot-gone',
        storyId: TEST_STORY_ID,
        name: 'Gone',
        ...entityBase,
        isDeleted: true,
        deletedAt: null,
      },
    ]);
    await seedLocalStory(database, { id: 'other-story', title: 'Other' });
    await database.db.insert(schema.plots).values({
      id: 'plot-other',
      storyId: 'other-story',
      name: 'Other',
      ...entityBase,
      deletedAt: null,
    });

    expect(await service.countActivePlots(TEST_STORY_ID)).toBe(1);
  });

  it('delegates the linear-compatibility check to the graph analysis', async () => {
    const compatibility = await createStoryService(database.db).checkLinearCompatibility(
      TEST_STORY_ID,
    );

    expect(compatibility.compatible).toBe(true);
  });
});

describe('StoryService delete notification', () => {
  it('warns on a server conflict but purges locally regardless', async () => {
    await linkStoryToServer(TEST_STORY_ID, 'server-1');
    (axios.defaults as { adapter?: unknown }).adapter = async () => ({
      data: {
        conflicts: [{ entity: 'Story', entityId: TEST_STORY_ID, reason: 'stale' }],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });

    await createStoryService(database.db).deleteStory(TEST_STORY_ID);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Server rejected deletion'));
    expect(
      await database.db.query.stories.findFirst({
        where: eq(schema.stories.id, TEST_STORY_ID),
      }),
    ).toBeUndefined();
  });

  it('purges locally when the notification fails offline', async () => {
    await linkStoryToServer(TEST_STORY_ID, 'server-1');
    (axios.defaults as { adapter?: unknown }).adapter = async () => {
      const error = new Error('Network Error') as Error & { code: string };
      error.code = 'ERR_NETWORK';
      throw error;
    };

    await createStoryService(database.db).deleteStory(TEST_STORY_ID);

    expect(
      await database.db.query.stories.findFirst({
        where: eq(schema.stories.id, TEST_STORY_ID),
      }),
    ).toBeUndefined();
  });
});

describe('StoryService export edge', () => {
  it('refuses to export a story that does not exist', async () => {
    await expect(createStoryService(database.db).exportFullStory('missing')).rejects.toThrow(
      'not found for export',
    );
  });
});

describe('StoryService import normalization', () => {
  it('keeps a single start and finish when a linear import flags several scenes', async () => {
    // The portable package validates ULIDs, like the transfer suite's ids.
    const storyId = '01J9GQK7X1D6N3Q2R4W5E6T7Y1';
    const userId = '01J9GQK7X1D6N3Q2R4W5E6T7Y2';
    await seedLocalStory(database, { id: storyId, userId });
    const service = createStoryService(database.db);
    await database.db.insert(schema.chapters).values({
      id: '01J9GQK7X1D6N3Q2R4W5E6T7Y3',
      storyId,
      name: 'One',
      index: 1,
      ...entityBase,
      deletedAt: null,
    });
    // A package written by hand (or by an older version) may flag several scenes; a linear
    // story has exactly one entry and one exit, so the import keeps the first of each.
    await database.db.insert(schema.scenes).values([
      {
        id: '01J9GQK7X1D6N3Q2R4W5E6T7Y4',
        storyId,
        chapterId: '01J9GQK7X1D6N3Q2R4W5E6T7Y3',
        name: 'A',
        index: 1,
        isStart: true,
        isFinish: false,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: '01J9GQK7X1D6N3Q2R4W5E6T7Y5',
        storyId,
        chapterId: '01J9GQK7X1D6N3Q2R4W5E6T7Y3',
        name: 'B',
        index: 2,
        isStart: true,
        isFinish: true,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: '01J9GQK7X1D6N3Q2R4W5E6T7Y6',
        storyId,
        chapterId: '01J9GQK7X1D6N3Q2R4W5E6T7Y3',
        name: 'C',
        index: 3,
        isStart: false,
        isFinish: true,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    await createLocationMapService(database.db).createMap(userId, {
      storyId,
      name: 'Atlas',
      description: null,
      content: { images: [], nodes: [] },
    });
    const exported = await service.exportFullStory(storyId);
    await service.deleteStory(storyId);
    (
      database.db as unknown as {
        transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
      }
    ).transaction = async (callback) => callback(database.db);

    const importedStoryId = await service.importFullStory(userId, exported, null);

    const scenes = await database.db.query.scenes.findMany();
    expect(scenes.filter((scene) => scene.isStart)).toHaveLength(1);
    expect(scenes.filter((scene) => scene.isFinish)).toHaveLength(1);
    const maps = await createLocationMapService(database.db).getMapsForStory(importedStoryId);
    expect(maps.map((map) => map.name)).toEqual(['Atlas']);
  });
});

describe('StoryService unlink edges', () => {
  it('does nothing for a story that is already local', async () => {
    const service = createStoryService(database.db);

    await service.unlinkFromServer(TEST_USER_ID, TEST_STORY_ID);

    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });

  it('drops a stale server link when the server row is gone, migrating favorites by the account', async () => {
    const service = createStoryService(database.db);
    await database.db
      .update(schema.stories)
      .set({ serverId: 'server-gone', myRole: 'owner' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    await database.db.insert(schema.favorites).values({
      id: 'fav-1',
      storyId: TEST_STORY_ID,
      entityId: 'char-1',
      entityType: 'Character',
      userId: 'server-user',
      ...entityBase,
    });

    await service.unlinkFromServer(TEST_USER_ID, TEST_STORY_ID);

    expect(await service.getStoryById(TEST_STORY_ID)).toMatchObject({ serverId: null });
    const favorites = await database.db.query.favorites.findMany();
    expect(favorites.map((row) => row.userId)).toEqual([TEST_USER_ID]);
  });
});
