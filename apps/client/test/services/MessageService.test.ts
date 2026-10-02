/**
 * @jest-environment node
 */
const mockGetAllServers = jest.fn();
const mockGetServerById = jest.fn();
const mockGetAllFriendships = jest.fn();
const mockApi = {
  getConversations: jest.fn(),
  getLimits: jest.fn(),
  getMessages: jest.fn(),
  send: jest.fn(),
  deleteMessage: jest.fn(),
  clearConversation: jest.fn(),
};
const mockIsOffline = jest.fn();
const mockNotify = jest.fn();
const mockEmit = jest.fn();
const mockObserve = jest.fn(async () => undefined);
const mockRetainServers = jest.fn();

jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: () => ({
    getAllServers: mockGetAllServers,
    getServerById: mockGetServerById,
  }),
}));
jest.mock('../../src/services/FriendshipService', () => ({
  __esModule: true,
  createFriendshipService: () => ({ getAllFriendships: mockGetAllFriendships }),
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  isOfflineError: (error: unknown) => mockIsOffline(error),
}));
jest.mock('../../src/services/MessageApiService', () => ({
  __esModule: true,
  messageApi: new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (...args: unknown[]) =>
          (mockApi as any)[name](...args),
    },
  ),
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: { getState: () => ({ showNotification: mockNotify }) },
}));
jest.mock('../../src/state/unseenMessagesStore', () => ({
  __esModule: true,
  useUnseenMessagesStore: {
    getState: () => ({
      observe: (...args: unknown[]) => mockObserve(...(args as [])),
      retainServers: (...args: unknown[]) => mockRetainServers(...args),
    }),
  },
}));
jest.mock('../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string, options?: { name?: string }) => `${key}:${options?.name ?? ''}` },
}));

import {
  conversationKey,
  createMessageService,
  MESSAGES_CHANGED,
  resetMessageNudgeState,
  setOpenConversation,
} from '../../src/services/MessageService';

const serverA = { id: 'server-a', name: 'Alpha', url: 'https://a.test' };
const serverB = { id: 'server-b', name: 'Beta', url: 'https://b.test' };
const friendship = (over: Record<string, unknown> = {}) => ({
  serverId: 'server-a',
  serverName: 'Alpha',
  status: 'friend',
  otherUserId: 'user-1',
  friendUsername: 'Bia',
  otherUserTag: 'bia',
  otherUserAvatarColor: '#fff',
  otherUserAvatarIcon: 'ion:star',
  ...over,
});
const message = (id: string, mine = false) => ({
  id,
  body: `body ${id}`,
  createdAt: '2026-01-01T00:00:00Z',
  mine,
});

const service = createMessageService({} as never);

beforeEach(() => {
  jest.clearAllMocks();
  resetMessageNudgeState();
  mockGetAllServers.mockResolvedValue([serverA, serverB]);
  mockGetServerById.mockImplementation(async (id: string) =>
    [serverA, serverB].find((server) => server.id === id),
  );
  mockGetAllFriendships.mockResolvedValue([friendship()]);
  mockIsOffline.mockReturnValue(false);
});

describe('getContacts', () => {
  it('offers the administrators of every server and the friends on each', async () => {
    mockGetAllFriendships.mockResolvedValue([
      friendship(),
      friendship({ status: 'pending', otherUserId: 'user-2' }),
      friendship({ status: 'blacklisted', otherUserId: 'user-3' }),
      friendship({ serverName: null, serverId: 'server-b', otherUserId: 'user-4' }),
    ]);

    const contacts = await service.getContacts();

    expect(contacts.map((c) => [c.serverId, c.kind, c.userId])).toEqual([
      ['server-a', 'admin', null],
      ['server-b', 'admin', null],
      ['server-a', 'direct', 'user-1'],
      ['server-b', 'direct', 'user-4'],
    ]);
    expect(contacts[2]).toMatchObject({ name: 'Bia', tag: 'bia', serverName: 'Alpha' });
    expect(contacts[3].serverName).toBe('server-b');
  });
});

describe('getInbox', () => {
  it('joins the conversations of every server with who they are with, newest first', async () => {
    mockApi.getConversations.mockImplementation(async (server: { id: string }) =>
      server.id === 'server-a'
        ? [
            { kind: 'direct', peerUserId: 'user-1', lastMessage: message('01') },
            { kind: 'direct', peerUserId: 'stranger', lastMessage: message('09') },
          ]
        : [{ kind: 'admin', peerUserId: null, lastMessage: message('05') }],
    );

    const inbox = await service.getInbox();

    expect(inbox.unreachableServerIds).toEqual([]);
    // A conversation with someone who is not a known friend is not shown.
    expect(
      inbox.entries.map((entry) => [entry.serverId, entry.kind, entry.lastMessage.id]),
    ).toEqual([
      ['server-b', 'admin', '05'],
      ['server-a', 'direct', '01'],
    ]);
  });

  it('keeps going, and says which servers did not answer', async () => {
    mockApi.getConversations.mockImplementation(async (server: { id: string }) => {
      if (server.id === 'server-b') throw new Error('down');
      return [{ kind: 'admin', peerUserId: null, lastMessage: message('01') }];
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const inbox = await service.getInbox();

    expect(inbox.entries).toHaveLength(1);
    expect(inbox.unreachableServerIds).toEqual(['server-b']);
    expect(warn).toHaveBeenCalled();

    warn.mockClear();
    mockIsOffline.mockReturnValue(true);
    await service.getInbox();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('what the user has not seen', () => {
  it("tells the unseen-messages store what each server's inbox says, and forgets servers that are gone", async () => {
    mockApi.getConversations.mockImplementation(async (server: { id: string }) =>
      server.id === 'server-a'
        ? [
            { kind: 'direct', peerUserId: 'user-1', lastMessage: message('01') },
            { kind: 'admin', peerUserId: null, lastMessage: message('02', true) },
          ]
        : [],
    );

    await service.getInbox();

    expect(mockObserve).toHaveBeenCalledWith('server-a', [
      { key: 'server-a|user-1', lastMessageId: '01', mine: false },
      { key: 'server-a|admin', lastMessageId: '02', mine: true },
    ]);
    expect(mockObserve).toHaveBeenCalledWith('server-b', []);
    expect(mockRetainServers).toHaveBeenCalledWith(['server-a', 'server-b']);
  });

  it('also looks when the server nudges, and counts the open conversation as seen', async () => {
    setOpenConversation(conversationKey('server-a', { kind: 'direct', userId: 'user-1' }));
    mockApi.getConversations.mockResolvedValue([
      { kind: 'direct', peerUserId: 'user-1', lastMessage: message('05') },
      { kind: 'direct', peerUserId: 'user-2', lastMessage: message('06') },
    ]);

    await service.handleServerNudge(serverA as never);

    expect(mockObserve).toHaveBeenCalledWith('server-a', [
      { key: 'server-a|user-1', lastMessageId: '05', mine: true },
      { key: 'server-a|user-2', lastMessageId: '06', mine: false },
    ]);
  });
});

describe('reading and writing', () => {
  it('reads a conversation and the limits from the server it is on', async () => {
    mockApi.getMessages.mockResolvedValue({ items: [], nextBefore: null });
    mockApi.getLimits.mockResolvedValue({ direct: { limit: null, used: 0 } });

    await service.getMessages('server-a', { kind: 'admin' }, 'cursor');
    await service.getLimits('server-a');

    expect(mockApi.getMessages).toHaveBeenCalledWith(serverA, { kind: 'admin' }, 'cursor');
    expect(mockApi.getLimits).toHaveBeenCalledWith(serverA);
  });

  it('refuses a server that is not registered any more', async () => {
    await expect(service.getMessages('gone', { kind: 'admin' })).rejects.toThrow('not found');
  });

  it('announces a change after sending, deleting and clearing', async () => {
    mockApi.send.mockResolvedValue(message('m1', true));

    await expect(service.send('server-a', { kind: 'admin' }, 'Hi')).resolves.toMatchObject({
      id: 'm1',
    });
    await service.deleteMessage('server-a', 'm1');
    await service.clearConversation('server-a', { kind: 'direct', userId: 'user-1' });

    expect(mockEmit).toHaveBeenCalledTimes(3);
    expect(mockEmit).toHaveBeenCalledWith(MESSAGES_CHANGED, 'server-a');
    expect(mockApi.deleteMessage).toHaveBeenCalledWith(serverA, 'm1');
    expect(mockApi.clearConversation).toHaveBeenCalledWith(serverA, {
      kind: 'direct',
      userId: 'user-1',
    });
  });
});

describe('handleServerNudge', () => {
  const direct = (id: string, mine = false) => ({
    kind: 'direct',
    peerUserId: 'user-1',
    lastMessage: message(id, mine),
  });

  it('tells the lists to read again, and only takes note the first time', async () => {
    mockApi.getConversations.mockResolvedValue([direct('01')]);

    await service.handleServerNudge(serverA as never);

    expect(mockEmit).toHaveBeenCalledWith(MESSAGES_CHANGED, 'server-a');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("announces a message that arrived since, by the friend's name", async () => {
    mockApi.getConversations.mockResolvedValueOnce([direct('01')]);
    await service.handleServerNudge(serverA as never);
    mockApi.getConversations.mockResolvedValueOnce([direct('02')]);

    await service.handleServerNudge(serverA as never);

    expect(mockNotify).toHaveBeenCalledWith('message_received:Bia', 'info');
  });

  it('announces the administrators answering, and nothing twice', async () => {
    mockApi.getConversations.mockResolvedValueOnce([]);
    await service.handleServerNudge(serverA as never);
    const admin = [{ kind: 'admin', peerUserId: null, lastMessage: message('03') }];
    mockApi.getConversations.mockResolvedValue(admin);

    await service.handleServerNudge(serverA as never);
    await service.handleServerNudge(serverA as never);

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('message_received:messages_administrators:', 'info');
  });

  it('stays quiet for what the user wrote, and for the conversation on screen', async () => {
    mockApi.getConversations.mockResolvedValueOnce([direct('01')]);
    await service.handleServerNudge(serverA as never);

    mockApi.getConversations.mockResolvedValueOnce([direct('02', true)]);
    await service.handleServerNudge(serverA as never);

    setOpenConversation(conversationKey('server-a', { kind: 'direct', userId: 'user-1' }));
    mockApi.getConversations.mockResolvedValueOnce([direct('03')]);
    await service.handleServerNudge(serverA as never);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not announce, after sending, the message the user just wrote', async () => {
    mockApi.getConversations.mockResolvedValueOnce([direct('01')]);
    await service.handleServerNudge(serverA as never);
    mockApi.send.mockResolvedValue(message('02', true));
    await service.send('server-a', { kind: 'direct', userId: 'user-1' }, 'Hi');
    mockApi.getConversations.mockResolvedValueOnce([direct('02')]);

    await service.handleServerNudge(serverA as never);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('survives a server that cannot be reached, quietly when it is only offline', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockApi.getConversations.mockRejectedValue(new Error('down'));

    await service.handleServerNudge(serverA as never);
    expect(warn).toHaveBeenCalled();

    warn.mockClear();
    mockIsOffline.mockReturnValue(true);
    await service.handleServerNudge(serverA as never);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
