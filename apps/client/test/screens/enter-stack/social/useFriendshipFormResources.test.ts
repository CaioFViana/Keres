const mockDb = {};
const mockCreateFriendshipService: jest.Mock = jest.fn(() => ({ id: 'friendship-service' }));
const mockCreateServerService: jest.Mock = jest.fn(() => ({ id: 'server-service' }));

jest.mock('@/src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('@/src/services/social/FriendshipService', () => ({
  createFriendshipService: (...args: unknown[]) => mockCreateFriendshipService(...args),
}));
jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: (...args: unknown[]) => mockCreateServerService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useFriendshipFormResources } from '@/src/screens/enter-stack/social/useFriendshipFormResources';

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates the friendship and server services for the form database', async () => {
  const view = await renderHook(() => useFriendshipFormResources());

  expect(view.result.current.drizzleDb).toBe(mockDb);
  expect(mockCreateFriendshipService).toHaveBeenCalledWith(mockDb);
  expect(mockCreateServerService).toHaveBeenCalledWith(mockDb);
  expect(view.result.current.friendshipServiceRef.current).toEqual({ id: 'friendship-service' });
  expect(view.result.current.serverServiceRef.current).toEqual({ id: 'server-service' });
});
