/**
 * @jest-environment node
 */
jest.mock('../../src/services/StoryInvitationApiService', () => ({
  storyInvitationApi: { list: jest.fn() },
}));

import { servers } from '../../src/db/schema';
import { storyInvitationApi } from '../../src/services/StoryInvitationApiService';
import {
  createStoryInvitationService,
  STORY_INVITATIONS_CHANGED,
} from '../../src/services/StoryInvitationService';
import { useNotificationStore } from '../../src/state/notificationStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const NOW = new Date('2026-09-28T12:00:00.000Z');
const list = storyInvitationApi.list as jest.Mock;

let database: TestDatabase;

const server = (id = 'server-1', idUser = 'me') => ({ id, idUser }) as never;

const seedServer = async (id = 'server-1', idUser = 'me', isDeleted = false) => {
  await database.db.insert(servers).values({
    id,
    idUser,
    userName: 'Caio',
    tag: 'caio',
    name: id,
    url: `https://${id}.test`,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted,
  });
};

const invitation = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  storyId: 'story-1',
  storyTitle: 'A Queda',
  inviterId: 'ana',
  inviterUsername: 'Ana',
  inviteeId: 'me',
  inviteeUsername: 'Me',
  permissionType: 'reader' as const,
  createdAt: '2026-09-27T10:00:00.000Z',
  ...overrides,
});

const showNotification = jest.fn();
const notifications = () => showNotification.mock.calls.map(([message]) => message as string);

beforeEach(async () => {
  jest.clearAllMocks();
  useNotificationStore.setState({ showNotification });
  database = await createTestDatabase();
  await seedServer();
});

afterEach(() => database.close());

describe('StoryInvitationService', () => {
  it('keeps the last copy of each server, visible offline', async () => {
    list.mockResolvedValue([invitation()]);
    const service = createStoryInvitationService(database.db);

    await service.syncWithServer(server());
    // The next launch has no network: what was seen stays.
    list.mockRejectedValue({ code: 'ERR_NETWORK' });
    await service.syncWithServer(server());

    expect(await service.getAll()).toEqual([
      { ...invitation(), serverId: 'server-1', serverUserId: 'me' },
    ]);
  });

  it('replaces a server copy with the server answer, leaving other servers alone', async () => {
    await seedServer('server-2', 'me-too');
    const service = createStoryInvitationService(database.db);
    list.mockResolvedValueOnce([invitation()]);
    await service.syncWithServer(server());
    list.mockResolvedValueOnce([invitation({ id: 'inv-9', inviteeId: 'me-too' })]);
    await service.syncWithServer(server('server-2', 'me-too'));

    // Declined or accepted elsewhere: gone from the server, gone here.
    list.mockResolvedValueOnce([]);
    await service.syncWithServer(server());

    expect((await service.getAll()).map((row) => row.id)).toEqual(['inv-9']);
  });

  it('announces only invitations received since the last sync, and tells the screens', async () => {
    const changed = jest.fn();
    entityEventEmitter.on(STORY_INVITATIONS_CHANGED, changed);
    const service = createStoryInvitationService(database.db);
    list.mockResolvedValueOnce([invitation()]);
    await service.syncWithServer(server());
    expect(notifications()).toHaveLength(1);

    list.mockResolvedValueOnce([
      invitation(),
      invitation({ id: 'inv-2', storyTitle: 'Outra', inviterUsername: 'Bia' }),
      // Sent by this user: nothing to announce.
      invitation({ id: 'inv-3', inviterId: 'me', inviteeId: 'carla' }),
    ]);
    await service.syncWithServer(server());

    expect(notifications()).toHaveLength(2);
    expect(notifications()[1]).toContain('Bia');
    expect(changed).toHaveBeenCalledTimes(2);
    entityEventEmitter.off(STORY_INVITATIONS_CHANGED, changed);
  });

  it('hides the invitations of a removed server', async () => {
    await seedServer('server-gone', 'me', true);
    list.mockResolvedValueOnce([invitation({ id: 'inv-x' })]);
    const service = createStoryInvitationService(database.db);
    await service.syncWithServer(server('server-gone'));

    expect(await service.getAll()).toEqual([]);
  });

  it('lets a real failure through', async () => {
    list.mockRejectedValue(new Error('500'));

    await expect(
      createStoryInvitationService(database.db).syncWithServer(server()),
    ).rejects.toThrow('500');
  });
});
