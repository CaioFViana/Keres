import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFavoriters } from '@/src/hooks/social/useFavoriters';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

const mockDb = {
  query: {
    stories: { findFirst: jest.fn() },
    servers: { findFirst: jest.fn() },
  },
};
const mockFavoriteService = { getBehavior: jest.fn(), getFavoriterIds: jest.fn() };
const mockResolveProfile = jest.fn();

jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('@/src/services/storymanagement/notes-tags-comments/FavoriteService', () => ({
  __esModule: true,
  createFavoriteService: jest.fn(() => mockFavoriteService),
}));
jest.mock('@/src/hooks/social/useUserProfileResolver', () => ({
  __esModule: true,
  useUserProfileResolver: jest.fn(() => mockResolveProfile),
}));
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

  it('reads the roster again only for a change that concerns this entity, story or friendships', async () => {
    const view = await renderHook(() => useFavoriters('story-1', 'entity-1', 'Character' as never));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const reads = () => mockFavoriteService.getFavoriterIds.mock.calls.length;
    const before = reads();

    await act(async () => {
      entityEventEmitter.emit('favorite_changed', 'story-1', 'Character' as never, 'entity-2');
      entityEventEmitter.emit('favorite_changed', 'story-2', 'Character' as never, 'entity-1');
      entityEventEmitter.emit('story_changed', 'story-2');
    });
    expect(reads()).toBe(before);

    mockFavoriteService.getFavoriterIds.mockResolvedValue(['other']);
    await act(async () => {
      entityEventEmitter.emit('favorite_changed', 'story-1', 'Character' as never, 'entity-1');
    });
    await waitFor(() => expect(view.result.current.profiles).toHaveLength(1));
    // Reloading is silent: the roster never goes back to loading.
    expect(view.result.current.loading).toBe(false);

    await act(async () => {
      entityEventEmitter.emit('story_changed', 'story-1');
      entityEventEmitter.emit('friendship_changed');
    });
    await waitFor(() => expect(reads()).toBe(before + 3));
  });

  it('hides the roster and stops loading when it cannot be read', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFavoriteService.getFavoriterIds.mockRejectedValue(new Error('disk'));
    const view = await renderHook(() => useFavoriters('story-1', 'entity-1', 'Character' as never));

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({ isPublic: false, profiles: [] });
    logged.mockRestore();
  });

  it('hides private behavior and clears the roster', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('off');
    const view = await renderHook(() => useFavoriters('story-1', 'entity-1', 'Character' as never));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({ isPublic: false, profiles: [] });
    expect(mockFavoriteService.getFavoriterIds).not.toHaveBeenCalled();
  });
});
