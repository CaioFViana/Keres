const mockDb = {
  query: {
    stories: { findFirst: jest.fn() },
    servers: { findFirst: jest.fn() },
  },
};
const mockFavoriteService = { getBehavior: jest.fn(), getFavoriterIds: jest.fn() };
const mockResolveProfile = jest.fn();

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/FavoriteService', () => ({
  __esModule: true,
  createFavoriteService: jest.fn(() => mockFavoriteService),
}));
jest.mock('../../src/hooks/useUserProfileResolver', () => ({
  __esModule: true,
  useUserProfileResolver: jest.fn(() => mockResolveProfile),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => Promise<void>) => React.useEffect(() => void load(), [load]),
  };
});

import { renderHook, waitFor } from '@testing-library/react-native';
import { useFavoriters } from '../../src/hooks/useFavoriters';

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.query.stories.findFirst.mockResolvedValue({ serverId: 'server-1' });
  mockDb.query.servers.findFirst.mockResolvedValue({ id: 'server-1' });
  mockFavoriteService.getBehavior.mockResolvedValue('individual_public');
  mockFavoriteService.getFavoriterIds.mockResolvedValue(['other', 'me']);
  mockResolveProfile.mockImplementation(async (id: string) => ({
    id,
    name: id === 'me' ? 'Me' : 'Zed',
    isCurrentUser: id === 'me',
  }));
});

describe('useFavoriters', () => {
  it('shows a sorted public roster resolved against the story server', async () => {
    const view = await renderHook(() => useFavoriters('story-1', 'entity-1', 'Character' as never));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({
      isPublic: true,
      profiles: [{ id: 'me' }, { id: 'other' }],
    });
    expect(mockResolveProfile).toHaveBeenCalledWith('me', { id: 'server-1' });
  });

  it('hides private behavior and clears the roster', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('off');
    const view = await renderHook(() => useFavoriters('story-1', 'entity-1', 'Character' as never));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({ isPublic: false, profiles: [] });
    expect(mockFavoriteService.getFavoriterIds).not.toHaveBeenCalled();
  });
});
