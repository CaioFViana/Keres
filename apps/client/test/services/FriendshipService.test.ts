/**
 * @jest-environment node
 */
jest.mock('../../src/services/FriendshipApiService', () => ({
  friendshipApiService: {
    acceptFriendRequest: jest.fn(),
    blacklistUser: jest.fn(),
    cancelSentFriendRequest: jest.fn(),
    declineFriendRequest: jest.fn(),
    unblacklistUser: jest.fn(),
    unfriendUser: jest.fn(),
  },
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { friendships, servers, users } from '../../src/db/schema';
import { createFriendshipService } from '../../src/services/FriendshipService';
import { friendshipApiService } from '../../src/services/FriendshipApiService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const SERVER_ID = 'server-1';
const LOCAL_USER_ID = 'user-local';
const FRIEND_ID = 'user-friend';
const OTHER_FRIEND_ID = 'user-other-friend';
const NOW = new Date('2026-08-14T12:00:00.000Z');

let database: TestDatabase;
let service: ReturnType<typeof createFriendshipService>;

async function seedServer() {
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
}

async function seedUser(idUser: string, overrides: Partial<typeof users.$inferInsert> = {}) {
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
    ...overrides,
  });
}

async function seedFriendship(
  id: string,
  overrides: Partial<typeof friendships.$inferInsert> = {},
) {
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
}

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  service = createFriendshipService(database.db);
  await seedServer();
  await seedUser(LOCAL_USER_ID, { displayName: 'Caio' });
  await seedUser(FRIEND_ID, {
    displayName: 'Ada Lovelace',
    tag: 'ada',
    avatarColor: '#123456',
    avatarIcon: 'sparkles',
    bio: 'Matemática',
  });
  await seedUser(OTHER_FRIEND_ID, { displayName: 'Grace Hopper', tag: 'grace' });
  jest.spyOn(entityEventEmitter, 'emit');
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('getAllFriendships', () => {
  it('resolves the other participant and their cached profile for both relationship directions', async () => {
    await seedFriendship('received');
    await seedFriendship('sent', {
      senderId: LOCAL_USER_ID,
      receiverId: OTHER_FRIEND_ID,
      friendUsername: 'Grace Hopper',
      status: FriendStatus.FRIEND,
    });

    const rows = await service.getAllFriendships();

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'received',
          otherUserId: FRIEND_ID,
          otherUserTag: 'ada',
          otherUserAvatarColor: '#123456',
          otherUserAvatarIcon: 'sparkles',
          otherUserBio: 'Matemática',
          serverName: 'Servidor principal',
        }),
        expect.objectContaining({
          id: 'sent',
          otherUserId: OTHER_FRIEND_ID,
          otherUserTag: 'grace',
        }),
      ]),
    );
  });
});

describe('remote friendship actions', () => {
  it('accepts a received pending request on that friendship server and updates the local row', async () => {
    await seedFriendship('received');
    (friendshipApiService.acceptFriendRequest as jest.Mock).mockResolvedValue({});

    await service.acceptFriendRequest('received', LOCAL_USER_ID);

    expect(friendshipApiService.acceptFriendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVER_ID }),
      FRIEND_ID,
    );
    expect((await service.getFriendshipById('received'))?.status).toBe(FriendStatus.FRIEND);
    expect(entityEventEmitter.emit).toHaveBeenCalledWith('friendship_changed');
  });

  it('rejects accepting a sent or non-pending request before making a remote call', async () => {
    await seedFriendship('sent', { senderId: LOCAL_USER_ID, receiverId: FRIEND_ID });

    await expect(service.acceptFriendRequest('sent', LOCAL_USER_ID)).rejects.toThrow(
      'Not authorized to accept',
    );
    expect(friendshipApiService.acceptFriendRequest).not.toHaveBeenCalled();
  });

  it('declines a received pending request and removes the local entry', async () => {
    await seedFriendship('received');
    (friendshipApiService.declineFriendRequest as jest.Mock).mockResolvedValue({});

    await service.declineFriendRequest('received', LOCAL_USER_ID);

    expect(friendshipApiService.declineFriendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVER_ID }),
      FRIEND_ID,
    );
    expect(await service.getFriendshipById('received')).toBeUndefined();
  });

  it('cancels a request only for its sender', async () => {
    await seedFriendship('sent', { senderId: LOCAL_USER_ID, receiverId: FRIEND_ID });
    (friendshipApiService.cancelSentFriendRequest as jest.Mock).mockResolvedValue({});

    await service.cancelSentFriendRequest('sent', LOCAL_USER_ID);

    expect(friendshipApiService.cancelSentFriendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVER_ID }),
      FRIEND_ID,
    );
    expect(await service.getFriendshipById('sent')).toBeUndefined();
  });

  it('unfriends either participant only after the relationship is accepted', async () => {
    await seedFriendship('friend', { status: FriendStatus.FRIEND });
    (friendshipApiService.unfriendUser as jest.Mock).mockResolvedValue({});

    await service.unfriendUser('friend', LOCAL_USER_ID);

    expect(friendshipApiService.unfriendUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVER_ID }),
      FRIEND_ID,
    );
    expect(await service.getFriendshipById('friend')).toBeUndefined();
  });

  it('keeps the server-reported blocker when blacklisting', async () => {
    await seedFriendship('friend', { status: FriendStatus.FRIEND });
    (friendshipApiService.blacklistUser as jest.Mock).mockResolvedValue({
      blockedById: LOCAL_USER_ID,
    });

    await service.blacklistUser('friend', LOCAL_USER_ID);

    expect(await service.getFriendshipById('friend')).toMatchObject({
      status: FriendStatus.BLACKLISTED,
      blockedById: LOCAL_USER_ID,
    });
  });

  it('does not allow the blocked person to remove another user’s blacklist', async () => {
    await seedFriendship('blocked', {
      status: FriendStatus.BLACKLISTED,
      blockedById: FRIEND_ID,
    });

    await expect(service.unblacklistUser('blocked', LOCAL_USER_ID)).rejects.toThrow(
      'Only the user who blacklisted',
    );
    expect(friendshipApiService.unblacklistUser).not.toHaveBeenCalled();
    expect(await service.getFriendshipById('blocked')).toBeDefined();
  });

  it('removes a blacklist when its owner confirms it remotely', async () => {
    await seedFriendship('blocked', {
      status: FriendStatus.BLACKLISTED,
      blockedById: LOCAL_USER_ID,
    });
    (friendshipApiService.unblacklistUser as jest.Mock).mockResolvedValue({});

    await service.unblacklistUser('blocked', LOCAL_USER_ID);

    expect(friendshipApiService.unblacklistUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: SERVER_ID }),
      FRIEND_ID,
    );
    expect(await service.getFriendshipById('blocked')).toBeUndefined();
  });
});
