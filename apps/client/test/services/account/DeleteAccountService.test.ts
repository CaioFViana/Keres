/** @jest-environment node */
import { eq } from 'drizzle-orm';
import * as schema from '@/src/db/schema';
import { createKeresAxiosInstance } from '@/src/services/api/apiClient';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';
import {
  AccountDeletionCleanupError,
  deleteServerAccount,
} from '@/src/services/account/DeleteAccountService';
import { mediaFileService } from '@/src/services/media/MediaFileService';
import { createServerService } from '@/src/services/servers/ServerService';
import { userApiService } from '@/src/services/api/UserApiService';
import { useStoryListStore } from '@/src/state/story/storyListStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { entityBase, seedLocalStory, TEST_NOW, TEST_STORY_ID } from '@/test/helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '@/test/helpers/testDb';

jest.mock('@/src/services/api/apiClient', () => ({
  createKeresAxiosInstance: jest.fn(),
  isOfflineError: jest.fn(() => false),
}));
jest.mock('@/src/services/media/MediaFileService', () => ({
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));
jest.mock('@/src/services/api/UserApiService', () => ({
  userApiService: { deleteOwnAccount: jest.fn() },
}));
jest.mock('@/src/services/auth/AuthTokenManager', () => ({
  authTokenManager: { clearAuthForServer: jest.fn() },
}));

const SERVER_ID = 'server';
const SERVER_URL = 'https://server.example';
const REMOTE_ME = 'remote-me';
const LOCAL_ME = 'local-me';
const READER_STORY_ID = 'reader-story';

let database: TestDatabase;
let post: jest.Mock;

const deleteOwnAccount = jest.mocked(userApiService.deleteOwnAccount);
const clearAuthForServer = jest.mocked(authTokenManager.clearAuthForServer);

const serverRow = () =>
  database.db.query.servers.findFirst({ where: eq(schema.servers.id, SERVER_ID) });
const storyRow = (storyId: string) =>
  database.db.query.stories.findFirst({ where: eq(schema.stories.id, storyId) });
const pendingOperations = () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();
const pendingConflicts = () =>
  database.db
    .select()
    .from(schema.syncConflicts)
    .where(eq(schema.syncConflicts.storyId, TEST_STORY_ID))
    .all();

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  await database.db.insert(schema.servers).values({
    id: SERVER_ID,
    idUser: REMOTE_ME,
    userName: 'alice',
    tag: 'alice',
    name: 'Main',
    url: SERVER_URL,
    ...entityBase,
  });
  // The person's own story on this server, with content and work the server has not received yet.
  await seedLocalStory(database, {
    serverId: SERVER_ID,
    myRole: 'owner',
    userId: REMOTE_ME,
    favoriteBehavior: 'individual',
  });
  await database.db.insert(schema.chapters).values({
    id: 'owned-chapter',
    storyId: TEST_STORY_ID,
    name: 'Capítulo',
    index: 1,
    ...entityBase,
  });
  await database.db.insert(schema.operationLogs).values({
    id: 'unsent-operation',
    storyId: TEST_STORY_ID,
    userId: REMOTE_ME,
    operationVersion: 1,
    operationType: 'update',
    entityType: 'Chapter',
    entityId: 'owned-chapter',
    payload: '{}',
    createdAt: TEST_NOW,
  });
  await database.db.insert(schema.syncConflicts).values({
    id: 'held-conflict',
    storyId: TEST_STORY_ID,
    entityType: 'Chapter',
    entityId: 'owned-chapter',
    reason: 'server_version_mismatch',
    localOperationType: 'update',
    localOperationIds: '["unsent-operation"]',
    localValues: '{}',
    detectedAt: TEST_NOW,
  });
  await database.db.insert(schema.storyPermissions).values({
    id: 'collaborator-cache',
    userId: 'friend',
    storyId: TEST_STORY_ID,
    serverId: SERVER_ID,
    permission: 'reader',
    ...entityBase,
  });
  // Someone else's story kept here as a cache: removing the server purges it, as "Remove" does.
  await database.db.insert(schema.stories).values({
    id: READER_STORY_ID,
    userId: 'someone-else',
    title: 'Leitura',
    type: 'linear',
    favoriteBehavior: 'individual',
    serverId: SERVER_ID,
    myRole: 'reader',
    ...entityBase,
  });
  await database.db.insert(schema.storyPublications).values({
    id: 'publication',
    serverId: SERVER_ID,
    storyId: TEST_STORY_ID,
    label: 'v1',
    operationVersion: 1,
    byteSize: 1,
    createdAt: TEST_NOW,
  });

  post = jest.fn().mockResolvedValue({ data: { conflicts: [] } });
  jest.mocked(createKeresAxiosInstance).mockReturnValue({
    post,
    setTokenProvider: jest.fn(),
    setActiveServer: jest.fn(),
  } as never);
  deleteOwnAccount.mockResolvedValue(undefined);
  clearAuthForServer.mockResolvedValue(undefined);

  useStoryListStore.setState({
    stories: [{ id: TEST_STORY_ID, serverId: SERVER_ID } as never],
  });
  useStoryStore.getState().setSelectedStory(null);
  useUserSettingsStore.setState({ userId: LOCAL_ME, activeServer: (await serverRow()) ?? null });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

const deleteAccount = async (password = 'correct-password') =>
  deleteServerAccount(database.db, (await serverRow())!, password, LOCAL_ME);

describe('deleteServerAccount', () => {
  it('keeps the owned story as a local story with nothing left to sync, and removes the server', async () => {
    await deleteAccount();

    expect(deleteOwnAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVER_ID }),
      'correct-password',
    );
    // No server call for the owned story: its copy is the server's business now.
    expect(createKeresAxiosInstance).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();

    expect(await storyRow(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ serverId: null, myRole: 'owner' }),
    );
    expect(await database.db.select().from(schema.chapters).all()).toEqual([
      expect.objectContaining({ id: 'owned-chapter', storyId: TEST_STORY_ID }),
    ]);
    expect(await pendingOperations()).toEqual([]);
    expect(await pendingConflicts()).toEqual([]);
    expect(
      await database.db
        .select()
        .from(schema.storyPermissions)
        .where(eq(schema.storyPermissions.storyId, TEST_STORY_ID))
        .all(),
    ).toEqual([]);
    expect(useStoryListStore.getState().stories).toEqual([
      expect.objectContaining({ id: TEST_STORY_ID, serverId: null }),
    ]);

    // The reader copy is purged the way removing the server purges it, its publications with it.
    expect(await storyRow(READER_STORY_ID)).toBeUndefined();
    expect(mediaFileService.deleteStoryMedia).toHaveBeenCalledWith(READER_STORY_ID);
    expect(await database.db.select().from(schema.storyPublications).all()).toEqual([]);

    // The server entry is gone, its tokens with it, and it is no longer the active server.
    expect(await serverRow()).toEqual(expect.objectContaining({ isDeleted: true }));
    expect(clearAuthForServer).toHaveBeenCalledWith(SERVER_ID);
    expect(useUserSettingsStore.getState().activeServer).toBeNull();
  });

  it('lets the owner delete the account while their story still has collaborators on the server', async () => {
    // The local permission cache says the story is shared: the server decides the collaborators' fate,
    // so the account goes ahead and the cache is dropped with the link.
    await deleteAccount();

    expect(deleteOwnAccount).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(await storyRow(TEST_STORY_ID)).toEqual(expect.objectContaining({ serverId: null }));
    expect(await serverRow()).toEqual(expect.objectContaining({ isDeleted: true }));
  });

  it('lets the same address be registered again once the flow is done', async () => {
    await deleteAccount();

    const service = createServerService(database.db);
    expect(await service.getServerByUrl(SERVER_URL)).toBeUndefined();
    const registered = await service.createServer({
      idUser: 'new-me',
      userName: 'alice',
      tag: 'alice',
      name: 'Again',
      url: `${SERVER_URL}/`,
      lastSyncDate: TEST_NOW,
    });
    expect(registered.id).not.toBe(SERVER_ID);
    expect(registered.url).toBe(SERVER_URL);
  });

  it('a wrong password changes nothing on this device', async () => {
    deleteOwnAccount.mockRejectedValue({ response: { status: 401 } });

    await expect(deleteAccount('wrong')).rejects.toEqual({ response: { status: 401 } });
    expect(post).not.toHaveBeenCalled();
    expect(await storyRow(TEST_STORY_ID)).toEqual(expect.objectContaining({ serverId: SERVER_ID }));
    expect(await pendingOperations()).toHaveLength(1);
    expect(await pendingConflicts()).toHaveLength(1);
    expect(await storyRow(READER_STORY_ID)).toBeDefined();
    expect(await serverRow()).toEqual(expect.objectContaining({ isDeleted: false }));
    expect(clearAuthForServer).not.toHaveBeenCalled();
    expect(useUserSettingsStore.getState().activeServer?.id).toBe(SERVER_ID);
  });

  it('being offline changes nothing on this device', async () => {
    deleteOwnAccount.mockRejectedValue(
      Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }),
    );

    await expect(deleteAccount()).rejects.toThrow('Network Error');
    expect(post).not.toHaveBeenCalled();
    expect(await storyRow(TEST_STORY_ID)).toEqual(expect.objectContaining({ serverId: SERVER_ID }));
    expect(await serverRow()).toEqual(expect.objectContaining({ isDeleted: false }));
    expect(clearAuthForServer).not.toHaveBeenCalled();
  });

  it('when the server confirmed but a genuine local write fails, clears the tokens and says the removal is unfinished', async () => {
    // A local failure after the server said yes: the story's link cannot be cleared.
    database.raw.exec(
      "CREATE TRIGGER fail_detach BEFORE UPDATE OF server_id ON stories WHEN NEW.server_id IS NULL BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
    );

    await expect(deleteAccount()).rejects.toBeInstanceOf(AccountDeletionCleanupError);
    expect(deleteOwnAccount).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(clearAuthForServer).toHaveBeenCalledWith(SERVER_ID);
    // The server entry stays listed, so "Remove this server" can finish the job from here.
    expect(await serverRow()).toEqual(expect.objectContaining({ isDeleted: false }));
    expect(await storyRow(TEST_STORY_ID)).toEqual(expect.objectContaining({ serverId: SERVER_ID }));
  });
});
