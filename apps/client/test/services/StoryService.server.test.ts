/** @jest-environment node */
jest.mock('../../src/services/apiClient', () => ({
  createKeresAxiosInstance: jest.fn(),
  isOfflineError: jest.fn(() => false),
}));
jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));

import * as schema from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { createKeresAxiosInstance } from '../../src/services/apiClient';
import { mediaFileService } from '../../src/services/MediaFileService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const SERVER_ID = 'server-1';
const SERVER_USER_ID = 'remote-author';
const LOCAL_USER_ID = 'local-reader';
const FAVORITE_ID = 'favorite-1';

let database: TestDatabase;
let post: jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  await seedLocalStory(database, {
    serverId: SERVER_ID,
    myRole: 'owner',
    favoriteBehavior: 'individual',
  });
  await database.db.insert(schema.servers).values({
    id: SERVER_ID,
    idUser: SERVER_USER_ID,
    userName: 'Autor remoto',
    name: 'Servidor de teste',
    url: 'https://server.example',
    ...entityBase,
  });
  await database.db.insert(schema.favorites).values({
    id: FAVORITE_ID,
    storyId: TEST_STORY_ID,
    entityId: TEST_STORY_ID,
    entityType: 'Story',
    userId: SERVER_USER_ID,
    ...entityBase,
  });

  post = jest.fn();
  (createKeresAxiosInstance as jest.Mock).mockReturnValue({
    post,
    setTokenProvider: jest.fn(),
    setActiveServer: jest.fn(),
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryService server lifecycle', () => {
  it('only unlinks after the server confirms deletion and migrates individual favorites', async () => {
    post.mockResolvedValue({ data: { conflicts: [] } });

    await createStoryService(database.db).unlinkFromServer(LOCAL_USER_ID, TEST_STORY_ID);

    expect(post).toHaveBeenCalledWith(`/sync/${TEST_STORY_ID}`, [
      { entity: 'Story', id: TEST_STORY_ID, type: 'delete' },
    ]);
    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ serverId: null, lastPublicFavoriteLog: 0 }),
    );
    expect(await database.db.query.favorites.findFirst()).toEqual(
      expect.objectContaining({ userId: LOCAL_USER_ID }),
    );
  });

  it('keeps the local server link when the remote delete reports a conflict', async () => {
    post.mockResolvedValue({
      data: { conflicts: [{ entity: 'Story', entityId: TEST_STORY_ID, message: 'not owner' }] },
    });

    await expect(
      createStoryService(database.db).unlinkFromServer(LOCAL_USER_ID, TEST_STORY_ID),
    ).rejects.toThrow('Server rejected the delete: not owner');

    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ serverId: SERVER_ID }),
    );
    expect(await database.db.query.favorites.findFirst()).toEqual(
      expect.objectContaining({ userId: SERVER_USER_ID }),
    );
  });

  it('removes a stale server link locally and recovers favorite identities from its rows', async () => {
    await database.db.delete(schema.servers).where(eq(schema.servers.id, SERVER_ID));

    await createStoryService(database.db).unlinkFromServer(LOCAL_USER_ID, TEST_STORY_ID);

    expect(createKeresAxiosInstance).not.toHaveBeenCalled();
    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ serverId: null, lastPublicFavoriteLog: 0 }),
    );
    expect(await database.db.query.favorites.findFirst()).toEqual(
      expect.objectContaining({ userId: LOCAL_USER_ID }),
    );
  });

  it('permanently deletes locally even if telling the server fails', async () => {
    post.mockRejectedValue(new Error('server unavailable'));
    (
      database.db as unknown as {
        transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
      }
    ).transaction = async (callback) => callback(database.db);

    await createStoryService(database.db).deleteStory(TEST_STORY_ID);

    expect(post).toHaveBeenCalledWith(`/sync/${TEST_STORY_ID}`, [
      { entity: 'Story', id: TEST_STORY_ID, type: 'delete' },
    ]);
    expect(await database.db.query.stories.findFirst()).toBeUndefined();
    expect(mediaFileService.deleteStoryMedia).toHaveBeenCalledWith(TEST_STORY_ID);
  });
});
