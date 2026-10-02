const mockT = (key: string) => key;
const mockService = {
  getMessages: jest.fn(),
  getLimits: jest.fn(),
  send: jest.fn(),
  deleteMessage: jest.fn(),
  clearConversation: jest.fn(),
};
const mockNotify = jest.fn();
const mockAlert = jest.fn();
const mockIsOffline = jest.fn();
const mockSetOpen = jest.fn();
const mockMarkSeen = jest.fn();
const mockListeners = new Map<string, Set<(...args: unknown[]) => void>>();

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  isOfflineError: (error: unknown) => mockIsOffline(error),
}));
jest.mock('../../src/services/MessageService', () => ({
  __esModule: true,
  MESSAGES_CHANGED: 'messages_changed',
  conversationKey: (serverId: string, peer: { kind: string; userId?: string }) =>
    `${serverId}|${peer.kind === 'admin' ? 'admin' : peer.userId}`,
  createMessageService: () => mockService,
  setOpenConversation: (key: string | null) => mockSetOpen(key),
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));
jest.mock('../../src/state/unseenMessagesStore', () => ({
  __esModule: true,
  useUnseenMessagesStore: {
    getState: () => ({ markSeen: (...args: unknown[]) => mockMarkSeen(...args) }),
  },
}));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (!mockListeners.has(event)) mockListeners.set(event, new Set());
      mockListeners.get(event)!.add(listener);
    },
    off: (event: string, listener: (...args: unknown[]) => void) => {
      mockListeners.get(event)?.delete(listener);
    },
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useConversation } from '../../src/hooks/useConversation';

const msg = (id: string, mine = false) => ({
  id,
  body: `body ${id}`,
  createdAt: '2026-01-01T00:00:00Z',
  mine,
});
const limits = (direct: number | null, directUsed: number) => ({
  direct: { limit: direct, used: directUsed },
  admin: { limit: 30, used: 5 },
});
const httpError = (status: number) => Object.assign(new Error('x'), { response: { status } });

const ADMIN = { kind: 'admin' } as const;
const FRIEND = { kind: 'direct', userId: 'user-1' } as const;

async function renderConversation(peer: { kind: string; userId?: string } = ADMIN) {
  const hook = await renderHook(() => useConversation('server-1', peer as never));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockIsOffline.mockReturnValue(false);
  mockService.getMessages.mockResolvedValue({ items: [msg('03'), msg('02')], nextBefore: null });
  mockService.getLimits.mockResolvedValue(limits(5, 1));
  mockService.send.mockImplementation(async (_server, _peer, body: string) => ({
    ...msg('09', true),
    body,
  }));
  mockService.deleteMessage.mockResolvedValue(undefined);
  mockService.clearConversation.mockResolvedValue(undefined);
});

describe('useConversation', () => {
  it('loads the newest page and what is left today, and marks itself as the open conversation', async () => {
    const { result, unmount } = await renderConversation(FRIEND);

    expect(result.current.messages.map((m) => m.id)).toEqual(['03', '02']);
    expect(result.current.remainingToday).toBe(4);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.unavailable).toBe(false);
    expect(mockService.getMessages).toHaveBeenCalledWith('server-1', FRIEND);
    expect(mockSetOpen).toHaveBeenCalledWith('server-1|user-1');

    await unmount();
    expect(mockSetOpen).toHaveBeenLastCalledWith(null);
  });

  it('marks what is on screen as seen, and what arrives while it is open', async () => {
    const { result } = await renderConversation(FRIEND);
    expect(mockMarkSeen).toHaveBeenLastCalledWith('server-1|user-1', '03');

    await act(async () => {
      await result.current.send('Hello');
    });

    expect(mockMarkSeen).toHaveBeenLastCalledWith('server-1|user-1', '09');
  });

  it('marks nothing seen in an empty conversation', async () => {
    mockService.getMessages.mockResolvedValue({ items: [], nextBefore: null });

    await renderConversation(FRIEND);

    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("counts the administrators' allowance for that conversation, and nothing when there is no ceiling", async () => {
    const admin = await renderConversation(ADMIN);
    expect(admin.result.current.remainingToday).toBe(25);

    mockService.getLimits.mockResolvedValue(limits(null, 0));
    const friend = await renderConversation(FRIEND);
    expect(friend.result.current.remainingToday).toBeNull();
  });

  it('has no allowance to show when the limits cannot be read', async () => {
    mockService.getLimits.mockRejectedValue(new Error('x'));

    const { result } = await renderConversation();

    expect(result.current.remainingToday).toBeNull();
    expect(result.current.messages).toHaveLength(2);
  });

  it('loads older pages as the reader scrolls, and not twice at once', async () => {
    mockService.getMessages
      .mockResolvedValueOnce({ items: [msg('09'), msg('08')], nextBefore: '08' })
      .mockResolvedValueOnce({ items: [msg('07')], nextBefore: null });
    const { result } = await renderConversation();
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadOlder();
    });

    expect(mockService.getMessages).toHaveBeenLastCalledWith('server-1', ADMIN, '08');
    expect(result.current.messages.map((m) => m.id)).toEqual(['09', '08', '07']);
    expect(result.current.hasMore).toBe(false);

    mockService.getMessages.mockClear();
    await act(async () => {
      await result.current.loadOlder();
    });
    expect(mockService.getMessages).not.toHaveBeenCalled();
  });

  it('reports a failure to load older messages', async () => {
    mockService.getMessages.mockResolvedValueOnce({ items: [msg('09')], nextBefore: '09' });
    const { result } = await renderConversation();
    mockService.getMessages.mockRejectedValueOnce(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      await result.current.loadOlder();
    });

    expect(mockNotify).toHaveBeenCalledWith('messages_load_failed', 'error');
    error.mockRestore();
  });

  it('puts a sent message first, refreshes the allowance, and says it went through', async () => {
    const { result } = await renderConversation();
    mockService.getLimits.mockResolvedValue(limits(5, 2));
    let sent = false;

    await act(async () => {
      sent = await result.current.send('Hello');
    });

    expect(sent).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith('server-1', ADMIN, 'Hello');
    expect(result.current.messages[0]).toMatchObject({ id: '09', body: 'Hello' });
    expect(result.current.sending).toBe(false);
  });

  it.each([
    [429, 'message_limit_reached'],
    [403, 'message_not_friends'],
    [500, 'message_send_failed'],
  ])('explains a send refused with %s', async (status, key) => {
    const { result } = await renderConversation();
    mockService.send.mockRejectedValue(httpError(status));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let sent = true;

    await act(async () => {
      sent = await result.current.send('Hello');
    });

    expect(sent).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(key, 'error');
    expect(result.current.messages.map((m) => m.id)).toEqual(['03', '02']);
    error.mockRestore();
  });

  it('says the server cannot be reached when offline', async () => {
    const { result } = await renderConversation();
    mockIsOffline.mockReturnValue(true);
    mockService.send.mockRejectedValue(new Error('offline'));

    await act(async () => {
      await result.current.send('Hello');
    });

    expect(mockNotify).toHaveBeenCalledWith('server_unreachable', 'error');
  });

  it('shows the conversation as unavailable when it cannot be read', async () => {
    mockService.getMessages.mockRejectedValue(new Error('down'));
    mockIsOffline.mockReturnValue(true);

    const { result } = await renderConversation();

    expect(result.current.unavailable).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('tells the user when loading failed for another reason', async () => {
    mockService.getMessages.mockRejectedValue(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = await renderConversation();

    expect(result.current.unavailable).toBe(true);
    expect(mockNotify).toHaveBeenCalledWith('messages_load_failed', 'error');
    error.mockRestore();
  });

  it('deletes one message after confirmation, only from this side', async () => {
    const { result } = await renderConversation();

    await act(async () => {
      result.current.deleteMessage('02');
    });
    expect(mockAlert).toHaveBeenCalledWith(
      'message_delete_title',
      'message_delete_confirm',
      expect.any(Array),
      {
        cancelable: true,
      },
    );
    const confirm = (
      mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
    ).find((button) => button.text === 'delete')!;
    await act(async () => {
      await confirm.onPress?.();
    });

    expect(mockService.deleteMessage).toHaveBeenCalledWith('server-1', '02');
    expect(result.current.messages.map((m) => m.id)).toEqual(['03']);
  });

  it('keeps the message when deleting fails', async () => {
    const { result } = await renderConversation();
    mockService.deleteMessage.mockRejectedValue(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      result.current.deleteMessage('02');
    });
    const confirm = (
      mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
    ).find((button) => button.text === 'delete')!;
    await act(async () => {
      await confirm.onPress?.();
    });

    expect(mockNotify).toHaveBeenCalledWith('message_delete_failed', 'error');
    expect(result.current.messages).toHaveLength(2);
    error.mockRestore();
  });

  it('clears the whole conversation after confirmation', async () => {
    const { result } = await renderConversation(FRIEND);

    await act(async () => {
      result.current.clear();
    });
    const confirm = (
      mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
    ).find((button) => button.text === 'delete')!;
    await act(async () => {
      await confirm.onPress?.();
    });

    expect(mockService.clearConversation).toHaveBeenCalledWith('server-1', FRIEND);
    expect(result.current.messages).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps the messages when clearing fails', async () => {
    const { result } = await renderConversation();
    mockService.clearConversation.mockRejectedValue(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      result.current.clear();
    });
    const confirm = (
      mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
    ).find((button) => button.text === 'delete')!;
    await act(async () => {
      await confirm.onPress?.();
    });

    expect(mockNotify).toHaveBeenCalledWith('message_clear_failed', 'error');
    expect(result.current.messages).toHaveLength(2);
    error.mockRestore();
  });

  it('reads again when the server says messages changed, keeping older pages already loaded', async () => {
    mockService.getMessages
      .mockResolvedValueOnce({ items: [msg('09'), msg('08')], nextBefore: '08' })
      .mockResolvedValueOnce({ items: [msg('05')], nextBefore: null });
    const { result } = await renderConversation();
    await act(async () => {
      await result.current.loadOlder();
    });
    mockService.getMessages.mockResolvedValueOnce({
      items: [msg('10'), msg('09'), msg('08')],
      nextBefore: '08',
    });

    await act(async () => {
      mockListeners.get('messages_changed')!.forEach((listener) => listener('server-1'));
    });

    await waitFor(() =>
      expect(result.current.messages.map((m) => m.id)).toEqual(['10', '09', '08', '05']),
    );
  });

  it('replaces what it shows when the newest page is the whole conversation, and ignores other servers', async () => {
    const { result } = await renderConversation();
    mockService.getMessages.mockClear();

    await act(async () => {
      mockListeners.get('messages_changed')!.forEach((listener) => listener('another-server'));
    });
    expect(mockService.getMessages).not.toHaveBeenCalled();

    mockService.getMessages.mockResolvedValueOnce({ items: [msg('04')], nextBefore: null });
    await act(async () => {
      mockListeners.get('messages_changed')!.forEach((listener) => listener());
    });
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['04']));
  });
});
