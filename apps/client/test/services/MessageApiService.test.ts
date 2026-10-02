/**
 * @jest-environment node
 */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockSetActiveServer = jest.fn();

jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  createKeresAxiosInstance: () => ({
    setTokenProvider: jest.fn(),
    setActiveServer: (...args: unknown[]) => mockSetActiveServer(...args),
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
}));

import { messageApi } from '../../src/services/MessageApiService';

const server = { id: 'server-1', url: 'https://keres.test' } as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MessageApiService', () => {
  it('reads the inbox and the daily limits of the given server', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ kind: 'admin' }] });
    mockGet.mockResolvedValueOnce({ data: { direct: { limit: 5, used: 1 } } });

    await expect(messageApi.getConversations(server)).resolves.toEqual([{ kind: 'admin' }]);
    await expect(messageApi.getLimits(server)).resolves.toEqual({ direct: { limit: 5, used: 1 } });

    expect(mockGet).toHaveBeenNthCalledWith(1, '/messages/conversations');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/messages/limits');
    expect(mockSetActiveServer).toHaveBeenCalledWith(server);
  });

  it('addresses the administrators and a friend by their own routes', async () => {
    mockGet.mockResolvedValue({ data: { items: [], nextBefore: null } });

    await messageApi.getMessages(server, { kind: 'admin' });
    await messageApi.getMessages(server, { kind: 'direct', userId: 'u/1' }, 'cursor-1');

    expect(mockGet).toHaveBeenNthCalledWith(1, '/messages/admin', { params: undefined });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/messages/user/u%2F1', {
      params: { before: 'cursor-1' },
    });
  });

  it('sends a message to the right conversation and returns it', async () => {
    mockPost.mockResolvedValue({ data: { id: 'm1', body: 'Hi', mine: true } });

    await expect(messageApi.send(server, { kind: 'admin' }, 'Hi')).resolves.toMatchObject({
      id: 'm1',
    });
    await messageApi.send(server, { kind: 'direct', userId: 'u1' }, 'Hello');

    expect(mockPost).toHaveBeenNthCalledWith(1, '/messages/admin', { body: 'Hi' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/messages/user/u1', { body: 'Hello' });
  });

  it('deletes a message, or a whole conversation, for this side', async () => {
    mockDelete.mockResolvedValue({ data: { ok: true } });

    await messageApi.deleteMessage(server, 'm/1');
    await messageApi.clearConversation(server, { kind: 'admin' });
    await messageApi.clearConversation(server, { kind: 'direct', userId: 'u1' });

    expect(mockDelete).toHaveBeenNthCalledWith(1, '/messages/m%2F1');
    expect(mockDelete).toHaveBeenNthCalledWith(2, '/messages/admin');
    expect(mockDelete).toHaveBeenNthCalledWith(3, '/messages/user/u1');
  });
});
