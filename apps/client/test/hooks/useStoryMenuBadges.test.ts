const mockFindStory = jest.fn();
const mockFindLogs = jest.fn();
const mockGetPublications = jest.fn();
const mockT = (key: string) => key;
const mockTranslation = { t: mockT };
const mockDb = {
  query: {
    stories: { findFirst: (...args: unknown[]) => mockFindStory(...args) },
    operationLogs: { findMany: (...args: unknown[]) => mockFindLogs(...args) },
  },
};

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockTranslation,
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../src/services/PublicationService', () => ({
  __esModule: true,
  createPublicationService: () => ({
    getPublicationsForStory: (...args: unknown[]) => mockGetPublications(...args),
  }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useStoryMenuBadges } from '../../src/hooks/useStoryMenuBadges';

beforeEach(() => {
  jest.clearAllMocks();
  mockFindStory.mockResolvedValue({ serverId: 'srv-1' });
  mockFindLogs.mockResolvedValue([]);
  mockGetPublications.mockResolvedValue([]);
});

describe('useStoryMenuBadges', () => {
  it('counts the changes still to reach the server on the history', async () => {
    mockFindLogs.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([]);
    const { result } = await renderHook(() => useStoryMenuBadges('story-1', 'x'));

    await waitFor(() =>
      expect(result.current.OperationLogStack).toEqual({ kind: 'count', value: 2 }),
    );
  });

  it('says louder when the server refused changes', async () => {
    mockFindLogs.mockResolvedValueOnce([{ id: 'a' }]).mockResolvedValueOnce([{ id: 'c' }]);
    const { result } = await renderHook(() => useStoryMenuBadges('story-1', 'x'));

    await waitFor(() =>
      expect(result.current.OperationLogStack).toEqual({
        kind: 'count',
        value: 1,
        attention: true,
      }),
    );
  });

  it('says the story is published once a version is out', async () => {
    mockGetPublications.mockResolvedValue([{ id: 'p1' }]);
    const { result } = await renderHook(() => useStoryMenuBadges('story-1', 'x'));

    await waitFor(() =>
      expect(result.current.StoryShare).toEqual({
        kind: 'text',
        value: 'story_share_badge_published',
      }),
    );
  });

  it('has nothing to say about a story that never left the device', async () => {
    mockFindStory.mockResolvedValue({ serverId: null });
    const { result } = await renderHook(() => useStoryMenuBadges('story-1', 'x'));

    await waitFor(() => expect(mockFindStory).toHaveBeenCalled());
    expect(result.current).toEqual({});
    expect(mockFindLogs).not.toHaveBeenCalled();
  });

  it('keeps the menu usable when the records cannot be read', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockFindStory.mockRejectedValue(new Error('db down'));
    const { result } = await renderHook(() => useStoryMenuBadges('story-1', 'x'));

    await waitFor(() => expect(mockFindStory).toHaveBeenCalled());
    expect(result.current).toEqual({});
    (console.log as jest.Mock).mockRestore();
  });

  it('asks for nothing without a story', async () => {
    const { result } = await renderHook(() => useStoryMenuBadges(undefined, 'x'));

    expect(result.current).toEqual({});
    expect(mockFindStory).not.toHaveBeenCalled();
  });
});
