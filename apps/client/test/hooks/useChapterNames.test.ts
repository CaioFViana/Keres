const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { useChapterNames } from '../../src/hooks/useChapterNames';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const scenes = [{ storyId: 'story' }] as never;
const getAllByStoryId = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getAllByStoryId.mockResolvedValue([
    { id: 'chapter-1', name: 'Opening' },
    { id: 'chapter-2', name: 'Resolution' },
  ]);
  (createChapterService as jest.Mock).mockReturnValue({ getAllByStoryId });
});

describe('useChapterNames', () => {
  it('resolves names only for chapters belonging to the scenes story', async () => {
    const view = await renderHook(() => useChapterNames(scenes));
    await waitFor(() => expect(view.result.current('chapter-1')).toBe('Opening'));

    expect(getAllByStoryId).toHaveBeenCalledWith('story');
    expect(view.result.current('chapter-2')).toBe('Resolution');
    expect(view.result.current('unknown')).toBeUndefined();
    expect(view.result.current(null)).toBeUndefined();
  });

  it('refreshes after a chapter change and clears names when scenes have no story', async () => {
    const view = await renderHook<
      ReturnType<typeof useChapterNames>,
      { currentScenes: typeof scenes }
    >(({ currentScenes }) => useChapterNames(currentScenes), {
      initialProps: { currentScenes: scenes },
    });
    await waitFor(() => expect(view.result.current('chapter-1')).toBe('Opening'));

    getAllByStoryId.mockResolvedValueOnce([{ id: 'chapter-1', name: 'Revised opening' }]);
    await act(async () => {
      entityEventEmitter.emit('chapter_changed', 'story');
    });
    await waitFor(() => expect(view.result.current('chapter-1')).toBe('Revised opening'));

    await act(async () => view.rerender({ currentScenes: [] as never }));
    await waitFor(() => expect(view.result.current('chapter-1')).toBeUndefined());
  });

  it('fails closed when chapter storage cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getAllByStoryId.mockRejectedValue(new Error('database unavailable'));

    const view = await renderHook(() => useChapterNames(scenes));
    await waitFor(() => expect(getAllByStoryId).toHaveBeenCalled());
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load chapter names:',
        expect.any(Error),
      ),
    );
    expect(view.result.current('chapter-1')).toBeUndefined();
  });
});
