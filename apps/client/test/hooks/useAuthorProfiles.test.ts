const mockFindStory = jest.fn();
const mockFindServer = jest.fn();
const mockResolveProfile = jest.fn();
const mockDb = {
  query: {
    stories: { findFirst: mockFindStory },
    servers: { findFirst: mockFindServer },
  },
};

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/hooks/useUserProfileResolver', () => ({
  __esModule: true,
  useUserProfileResolver: jest.fn(() => mockResolveProfile),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuthorProfiles } from '../../src/hooks/useAuthorProfiles';

beforeEach(() => {
  jest.clearAllMocks();
  mockFindStory.mockResolvedValue({ serverId: 'server-1' });
  mockFindServer.mockResolvedValue({ id: 'server-1', url: 'https://server.example' });
  mockResolveProfile.mockImplementation(async (id: string) => ({ id, name: `User ${id}` }));
});

describe('useAuthorProfiles', () => {
  it('deduplicates ids and resolves them against the story server', async () => {
    const view = await renderHook(() => useAuthorProfiles('story', ['b', 'a', 'b']));
    await waitFor(() => expect(Object.keys(view.result.current).sort()).toEqual(['a', 'b']));

    expect(mockFindStory).toHaveBeenCalledTimes(1);
    expect(mockFindServer).toHaveBeenCalledTimes(1);
    expect(mockResolveProfile).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ id: 'server-1' }),
    );
    expect(mockResolveProfile).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ id: 'server-1' }),
    );
    expect(view.result.current.a).toMatchObject({ name: 'User a' });
  });

  it('does not query when disabled and clears profiles when the input becomes empty', async () => {
    const view = await renderHook<
      ReturnType<typeof useAuthorProfiles>,
      { ids: string[]; enabled: boolean }
    >(({ ids, enabled }) => useAuthorProfiles('story', ids, enabled), {
      initialProps: { ids: ['a'], enabled: false },
    });
    expect(mockFindStory).not.toHaveBeenCalled();

    await view.rerender({ ids: ['a'], enabled: true });
    await waitFor(() => expect(view.result.current.a).toBeDefined());
    await view.rerender({ ids: [], enabled: true });
    await waitFor(() => expect(view.result.current).toEqual({}));
  });
});
