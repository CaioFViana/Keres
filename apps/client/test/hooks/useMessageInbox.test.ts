const mockService = { getInbox: jest.fn(), getContacts: jest.fn() };
const mockNotify = jest.fn();
const mockListeners = new Map<string, Set<(...args: unknown[]) => void>>();

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../src/services/MessageService', () => ({
  __esModule: true,
  MESSAGES_CHANGED: 'messages_changed',
  createMessageService: () => mockService,
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
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
import { useMessageInbox } from '../../src/hooks/useMessageInbox';

const inbox = (ids: string[]) => ({
  entries: ids.map((id) => ({ serverId: id, kind: 'admin', userId: null, lastMessage: { id } })),
  unreachableServerIds: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockService.getInbox.mockResolvedValue(inbox(['a']));
  mockService.getContacts.mockResolvedValue([{ serverId: 'a', kind: 'admin' }]);
});

describe('useMessageInbox', () => {
  it('loads the inbox and the people the user can write to', async () => {
    const { result } = await renderHook(() => useMessageInbox());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.inbox.entries).toHaveLength(1);
    expect(result.current.contacts).toEqual([{ serverId: 'a', kind: 'admin' }]);
  });

  it('reads again when messages change and when friendships do', async () => {
    const { result } = await renderHook(() => useMessageInbox());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockService.getInbox.mockResolvedValue(inbox(['a', 'b']));

    await act(async () => {
      mockListeners.get('messages_changed')!.forEach((listener) => listener());
    });
    await waitFor(() => expect(result.current.inbox.entries).toHaveLength(2));

    mockService.getInbox.mockResolvedValue(inbox(['c']));
    await act(async () => {
      mockListeners.get('friendship_changed')!.forEach((listener) => listener());
    });
    await waitFor(() => expect(result.current.inbox.entries).toHaveLength(1));
  });

  it('stops listening when it unmounts', async () => {
    const hook = await renderHook(() => useMessageInbox());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await hook.unmount();

    expect(mockListeners.get('messages_changed')!.size).toBe(0);
    expect(mockListeners.get('friendship_changed')!.size).toBe(0);
  });

  it('tells the user when the messages could not be read, and stops loading', async () => {
    mockService.getInbox.mockRejectedValue(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = await renderHook(() => useMessageInbox());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockNotify).toHaveBeenCalledWith('messages_load_failed', 'error');
    expect(result.current.inbox.entries).toEqual([]);
    error.mockRestore();
  });
});
