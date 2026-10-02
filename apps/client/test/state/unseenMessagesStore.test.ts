const mockStorage = new Map<string, string>();
const mockGetItem = jest.fn(async (key: string) => mockStorage.get(key) ?? null);
const mockSetItem = jest.fn(async (key: string, value: string) => {
  mockStorage.set(key, value);
});
const mockRemoveItem = jest.fn(async (key: string) => {
  mockStorage.delete(key);
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: [string]) => mockGetItem(...args),
    setItem: (...args: [string, string]) => mockSetItem(...args),
    removeItem: (...args: [string]) => mockRemoveItem(...args),
  },
}));

import { useUnseenMessagesStore } from '../../src/state/unseenMessagesStore';

const KEY = '@keres/messages-seen';
const store = () => useUnseenMessagesStore.getState();
const conversation = (key: string, lastMessageId: string, mine = false) => ({
  key,
  lastMessageId,
  mine,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  store().reset();
  jest.clearAllMocks();
});

describe('unseenMessagesStore', () => {
  it('takes what was already on a server the first time as seen', async () => {
    await store().observe('srv-1', [
      conversation('srv-1|admin', '05'),
      conversation('srv-1|u1', '07'),
    ]);

    expect(store().unseen).toEqual({});
    expect(store().seen).toEqual({ 'srv-1|admin': '05', 'srv-1|u1': '07' });
  });

  it('marks as unseen what the other side wrote after that, and a conversation never seen before', async () => {
    await store().observe('srv-1', [conversation('srv-1|u1', '07')]);

    await store().observe('srv-1', [
      conversation('srv-1|u1', '09'),
      conversation('srv-1|u2', '08'),
    ]);

    expect(store().unseen).toEqual({ 'srv-1|u1': '09', 'srv-1|u2': '08' });
  });

  it("has nothing unseen when the last word was the user's own", async () => {
    await store().observe('srv-1', [conversation('srv-1|u1', '07')]);

    await store().observe('srv-1', [conversation('srv-1|u1', '09', true)]);

    expect(store().unseen).toEqual({});
    expect(store().seen['srv-1|u1']).toBe('09');
  });

  it('clears the mark when the conversation is opened, and not for an older message', async () => {
    await store().observe('srv-1', [conversation('srv-1|u1', '07')]);
    await store().observe('srv-1', [conversation('srv-1|u1', '09')]);

    await store().markSeen('srv-1|u1', '08');
    expect(store().unseen).toEqual({ 'srv-1|u1': '09' });

    await store().markSeen('srv-1|u1', '09');
    expect(store().unseen).toEqual({});
    expect(store().seen['srv-1|u1']).toBe('09');
  });

  it('does not write anything when nothing changed', async () => {
    await store().observe('srv-1', [conversation('srv-1|u1', '07')]);
    mockSetItem.mockClear();

    await store().markSeen('srv-1|u1', '03');

    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('drops what a server no longer reports, and keeps the other servers', async () => {
    await store().observe('srv-1', []);
    await store().observe('srv-2', []);
    await store().observe('srv-1', [conversation('srv-1|u1', '09')]);
    await store().observe('srv-2', [conversation('srv-2|u1', '09')]);
    expect(Object.keys(store().unseen).sort()).toEqual(['srv-1|u1', 'srv-2|u1']);

    await store().observe('srv-1', []);

    expect(store().unseen).toEqual({ 'srv-2|u1': '09' });
  });

  it('forgets the servers that are no longer registered', async () => {
    await store().observe('srv-1', []);
    await store().observe('srv-2', []);
    await store().observe('srv-1', [conversation('srv-1|u1', '09')]);
    await store().observe('srv-2', [conversation('srv-2|u1', '09')]);

    store().retainServers(['srv-2']);
    expect(store().unseen).toEqual({ 'srv-2|u1': '09' });

    store().retainServers(['srv-2']);
    expect(store().unseen).toEqual({ 'srv-2|u1': '09' });
  });

  it('keeps what was seen across runs, so a message already opened does not come back', async () => {
    await store().observe('srv-1', [conversation('srv-1|u1', '07')]);
    await store().observe('srv-1', [conversation('srv-1|u1', '09')]);
    await store().markSeen('srv-1|u1', '09');
    const saved = mockStorage.get(KEY)!;

    store().reset();
    mockStorage.set(KEY, saved);
    await store().observe('srv-1', [conversation('srv-1|u1', '09')]);

    expect(store().unseen).toEqual({});
    expect(mockGetItem).toHaveBeenCalledWith(KEY);
  });

  it('reads a corrupt or missing entry as empty', async () => {
    mockStorage.set(KEY, '{not json');
    await store().hydrate();
    expect(store().seen).toEqual({});

    store().reset();
    mockGetItem.mockRejectedValueOnce(new Error('storage down'));
    await expect(store().hydrate()).resolves.toBeUndefined();
  });

  it('lives without storage for the writes', async () => {
    mockSetItem.mockRejectedValue(new Error('full'));

    await expect(
      store().observe('srv-1', [conversation('srv-1|u1', '07')]),
    ).resolves.toBeUndefined();

    mockSetItem.mockImplementation(async (key: string, value: string) => {
      mockStorage.set(key, value);
    });
  });

  it('forgets everything on reset, storage included', async () => {
    await store().observe('srv-1', [conversation('srv-1|u1', '07')]);

    store().reset();

    expect(store().seen).toEqual({});
    expect(store().baselined).toEqual([]);
    expect(mockRemoveItem).toHaveBeenCalledWith(KEY);
  });
});
