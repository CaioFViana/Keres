/**
 * @jest-environment node
 */
jest.mock('../../src/services/FriendshipApiService', () => ({
  friendshipApiService: {
    acceptFriendRequest: jest.fn(),
    blacklistUser: jest.fn(),
    cancelSentFriendRequest: jest.fn(),
    declineFriendRequest: jest.fn(),
    getFriendships: jest.fn(),
    unblacklistUser: jest.fn(),
    unfriendUser: jest.fn(),
  },
}));
jest.mock('../../src/services/UserApiService', () => ({
  userApiService: { getOwnProfile: jest.fn() },
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { friendships, servers, users } from '../../src/db/schema';
import { friendshipApiService } from '../../src/services/FriendshipApiService';
import { createFriendshipService } from '../../src/services/FriendshipService';
import { userApiService } from '../../src/services/UserApiService';
import { useNotificationStore } from '../../src/state/notificationStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The friendship service's local writes, action guards and server reconciliation.
 *
 * The remote actions' happy paths already live in `FriendshipService.test.ts`. What was missing is
 * the rest of the contract: the guards that reject a wrong-state action before any round-trip
 * (declining a sent request, unfriending a pending one, unblacklisting a friend), the local
 * add/bulk/update/delete primitives, and the sync that reconciles the local table with the server:
 * stale rows deleted, fresh profiles upserted, and a notification for each new request or
 * acceptance. The sync also dedupes concurrent runs per server, because the initial
 * reconciliation and a reconnect can otherwise stampede the same write transaction.
 *
 * The API services are mocked at the module boundary - the sync's HTTP shape belongs to
 * `serverBoundApiServices.test.ts`; here the server is just data in, rows out.
 */

const SERVER_ID = 'server-1';
const LOCAL_USER_ID = 'user-local';
const FRIEND_ID = 'user-friend';
const NOW = new Date('2026-08-14T12:00:00.000Z');

let database: TestDatabase;
let service: ReturnType<typeof createFriendshipService>;

const api = friendshipApiService as unknown as Record<string, jest.Mock>;
const userApi = userApiService as unknown as Record<string, jest.Mock>;

const seedServer = async (): Promise<void> => {
  await database.db.insert(servers).values({
    id: SERVER_ID,
    idUser: LOCAL_USER_ID,
    userName: 'Caio',
    tag: 'caio',
    name: 'Servidor principal',
    url: 'https://example.test',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
  });
};

const seedUser = async (idUser: string): Promise<void> => {
  await database.db.insert(users).values({
    idUser,
    idServer: SERVER_ID,
    displayName: idUser,
    tag: null,
    avatarColor: null,
    avatarIcon: null,
    bio: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
  });
};

const seedFriendship = async (
  id: string,
  overrides: Partial<typeof friendships.$inferInsert> = {},
): Promise<void> => {
  await database.db.insert(friendships).values({
    id,
    serverId: SERVER_ID,
    senderId: FRIEND_ID,
    receiverId: LOCAL_USER_ID,
    friendUsername: 'Ada',
    status: FriendStatus.PENDING,
    blockedById: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
};

const serverRow = async () =>
  database.db.query.servers.findFirst({
    where: (table, { eq }) => eq(table.id, SERVER_ID),
  });

const notificationsOf = () =>
  useNotificationStore
    .getState()
    .currentNotifications.filter((notification) => notification !== null)
    .map((notification) => notification.message);

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  service = createFriendshipService(database.db);
  await seedServer();
  // Friendship ends are foreign keys to users: both participants must exist first.
  await seedUser(LOCAL_USER_ID);
  await seedUser(FRIEND_ID);
  // better-sqlite3 transactions are synchronous; give this suite the production async semantics.
  (
    database.db as unknown as {
      transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
    }
  ).transaction = async (callback) => callback(database.db);
  useNotificationStore.getState().clearAll();
  jest.spyOn(entityEventEmitter, 'emit');
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('FriendshipService local writes', () => {
  it('adds, updates and deletes a friendship, announcing every change', async () => {
    const created = await service.addFriendship({
      serverId: SERVER_ID,
      senderId: LOCAL_USER_ID,
      receiverId: FRIEND_ID,
      friendUsername: 'Ada',
      status: FriendStatus.PENDING,
      blockedById: null,
    });

    expect(await service.getFriendshipById(created.id)).toMatchObject({
      senderId: LOCAL_USER_ID,
      status: FriendStatus.PENDING,
    });

    await service.updateFriendship(created.id, { status: FriendStatus.FRIEND });
    expect((await service.getFriendshipById(created.id))?.status).toBe(FriendStatus.FRIEND);

    await service.deleteFriendship(created.id);
    expect(await service.getFriendshipById(created.id)).toBeUndefined();
    expect(entityEventEmitter.emit).toHaveBeenCalledWith('friendship_changed');
  });

  it('bulk-upserts on the id, so a re-sync overwrites instead of duplicating', async () => {
    await seedFriendship('known', { friendUsername: 'Old name' });

    await service.bulkAddFriendships([
      {
        id: 'known',
        serverId: SERVER_ID,
        senderId: FRIEND_ID,
        receiverId: LOCAL_USER_ID,
        friendUsername: 'New name',
        status: FriendStatus.FRIEND,
        blockedById: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    // An empty batch is a no-op, not an error.
    await service.bulkAddFriendships([]);

    const rows = await database.db.query.friendships.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ friendUsername: 'New name', status: FriendStatus.FRIEND });
  });
});

describe('FriendshipService action guards', () => {
  it('rejects every action on a friendship that does not exist', async () => {
    await expect(service.declineFriendRequest('missing', LOCAL_USER_ID)).rejects.toThrow(
      'Friendship not found.',
    );
    await expect(service.cancelSentFriendRequest('missing', LOCAL_USER_ID)).rejects.toThrow(
      'Friendship not found.',
    );
    await expect(service.unfriendUser('missing', LOCAL_USER_ID)).rejects.toThrow(
      'Friendship not found.',
    );
    await expect(service.unblacklistUser('missing', LOCAL_USER_ID)).rejects.toThrow(
      'Friendship not found.',
    );
  });

  it('rejects actions whose state does not allow them, before any remote call', async () => {
    await seedFriendship('sent', { senderId: LOCAL_USER_ID, receiverId: FRIEND_ID });
    await seedFriendship('friend', {
      senderId: FRIEND_ID,
      receiverId: LOCAL_USER_ID,
      status: FriendStatus.FRIEND,
    });

    // Declining is for the receiver of a pending request; canceling is for its sender.
    await expect(service.declineFriendRequest('sent', LOCAL_USER_ID)).rejects.toThrow(
      'Not authorized to decline',
    );
    await expect(service.cancelSentFriendRequest('friend', FRIEND_ID)).rejects.toThrow(
      'Not authorized to cancel',
    );
    // Unfriending needs an accepted relationship; unblacklisting needs a blacklist.
    await expect(service.unfriendUser('sent', LOCAL_USER_ID)).rejects.toThrow(
      'Users are not friends.',
    );
    await expect(service.unblacklistUser('friend', LOCAL_USER_ID)).rejects.toThrow(
      'User is not blacklisted.',
    );
    expect(api.declineFriendRequest).not.toHaveBeenCalled();
    expect(api.cancelSentFriendRequest).not.toHaveBeenCalled();
    expect(api.unfriendUser).not.toHaveBeenCalled();
    expect(api.unblacklistUser).not.toHaveBeenCalled();
  });

  it('rejects an action whose server row is gone', async () => {
    // The foreign key normally forbids this row: loosen it for the setup to simulate a legacy
    // row left behind by an interrupted server removal.
    database.raw.exec('PRAGMA foreign_keys = OFF');
    await seedFriendship('orphan', { serverId: 'server-gone' });
    database.raw.exec('PRAGMA foreign_keys = ON');

    await expect(service.acceptFriendRequest('orphan', LOCAL_USER_ID)).rejects.toThrow(
      'Server not found for this friendship.',
    );
  });
});

describe('FriendshipService sync', () => {
  const enriched = (overrides: Record<string, unknown> = {}) => ({
    id: 'remote-1',
    senderId: FRIEND_ID,
    receiverId: LOCAL_USER_ID,
    friendUsername: 'Ada',
    status: FriendStatus.PENDING,
    blockedById: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    otherUserId: FRIEND_ID,
    otherUserTag: 'ada',
    otherUserAvatarColor: '#123456',
    otherUserAvatarIcon: 'sparkles',
    otherUserBio: 'Matemática',
    ...overrides,
  });

  it('adopts the server list, refreshes profiles and notifies on new requests', async () => {
    await seedFriendship('stale-local');
    api.getFriendships.mockResolvedValue([enriched()]);
    userApi.getOwnProfile.mockResolvedValue({ username: 'Caio', tag: 'caio' });

    await service.syncFriendshipsWithServer(LOCAL_USER_ID, (await serverRow())!);

    const rows = await database.db.query.friendships.findMany();
    expect(rows.map((row) => row.id)).toEqual(['remote-1']);
    const friend = await database.db.query.users.findFirst({
      where: (table, { eq }) => eq(table.idUser, FRIEND_ID),
    });
    expect(friend).toMatchObject({ displayName: 'Ada', tag: 'ada', bio: 'Matemática' });
    const self = await database.db.query.users.findFirst({
      where: (table, { eq }) => eq(table.idUser, LOCAL_USER_ID),
    });
    expect(self).toMatchObject({ displayName: 'Caio', tag: 'caio' });
    expect(notificationsOf()).toEqual(['New friend request from Ada']);
    expect(entityEventEmitter.emit).toHaveBeenCalledWith('friendship_changed');
  });

  it('notifies when a pending request turns into a friendship', async () => {
    await seedFriendship('remote-1', { status: FriendStatus.PENDING });
    api.getFriendships.mockResolvedValue([enriched({ status: FriendStatus.FRIEND })]);
    userApi.getOwnProfile.mockResolvedValue(undefined);

    await service.syncFriendshipsWithServer(LOCAL_USER_ID, (await serverRow())!);

    expect((await service.getFriendshipById('remote-1'))?.status).toBe(FriendStatus.FRIEND);
    expect(notificationsOf()).toEqual(['Friend request from Ada accepted!']);
  });

  it('keeps other servers rows while reconciling one server', async () => {
    await database.db.insert(servers).values({
      id: 'server-2',
      idUser: LOCAL_USER_ID,
      userName: 'Caio',
      name: 'Second',
      url: 'https://second.test',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });
    await seedFriendship('other-server-row', { serverId: 'server-2' });
    api.getFriendships.mockResolvedValue([]);
    userApi.getOwnProfile.mockResolvedValue(undefined);

    await service.syncFriendshipsWithServer(LOCAL_USER_ID, (await serverRow())!);

    expect(await service.getFriendshipById('other-server-row')).toBeDefined();
  });

  it('shares one in-flight sync between concurrent callers', async () => {
    api.getFriendships.mockResolvedValue([]);
    userApi.getOwnProfile.mockResolvedValue(undefined);
    const server = (await serverRow())!;

    await Promise.all([
      service.syncFriendshipsWithServer(LOCAL_USER_ID, server),
      service.syncFriendshipsWithServer(LOCAL_USER_ID, server),
    ]);

    expect(api.getFriendships).toHaveBeenCalledTimes(1);
  });

  it('keeps local rows as-is when the server is unreachable', async () => {
    await seedFriendship('local-only');
    const offline = new Error('Network Error') as Error & { code: string };
    offline.code = 'ERR_NETWORK';
    api.getFriendships.mockRejectedValue(offline);
    userApi.getOwnProfile.mockResolvedValue(undefined);

    await service.syncFriendshipsWithServer(LOCAL_USER_ID, (await serverRow())!);

    expect(await service.getFriendshipById('local-only')).toBeDefined();
    expect(console.log).toHaveBeenCalledWith(
      'FriendshipService: server unreachable, skipping friendship sync.',
    );
  });

  it('rethrows a non-offline fetch failure without touching the rows', async () => {
    await seedFriendship('local-only');
    api.getFriendships.mockRejectedValue(new Error('boom'));
    userApi.getOwnProfile.mockResolvedValue(undefined);

    await expect(
      service.syncFriendshipsWithServer(LOCAL_USER_ID, (await serverRow())!),
    ).rejects.toThrow('boom');
    expect(await service.getFriendshipById('local-only')).toBeDefined();
  });
});
