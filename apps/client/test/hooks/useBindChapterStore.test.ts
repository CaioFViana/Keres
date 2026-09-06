const mockDb = {};
const mockStore = {
  chapters: [{ id: 'chapter-1' }],
  fetchChapters: jest.fn(),
  initializeService: jest.fn(),
  setDbAndStoryId: jest.fn(),
};

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/state/chapterStore', () => ({
  __esModule: true,
  useChapterStore: jest.fn(() => mockStore),
}));

import { renderHook } from '@testing-library/react-native';
import { useBindChapterStore } from '../../src/hooks/useBindChapterStore';

beforeEach(() => jest.clearAllMocks());

describe('useBindChapterStore', () => {
  it('binds the active story before initializing and exposes the chapter list', async () => {
    const view = await renderHook(() => useBindChapterStore('story', false));

    expect(mockStore.setDbAndStoryId).toHaveBeenCalledWith(mockDb, 'story');
    expect(mockStore.initializeService).toHaveBeenCalledTimes(1);
    expect(mockStore.fetchChapters).not.toHaveBeenCalled();
    expect(view.result.current.chapters).toBe(mockStore.chapters);
  });

  it('only fetches when requested and a story is available', async () => {
    const view = await renderHook<ReturnType<typeof useBindChapterStore>, { fetchWhen: boolean }>(
      ({ fetchWhen }) => useBindChapterStore('story', fetchWhen),
      { initialProps: { fetchWhen: true } },
    );
    expect(mockStore.fetchChapters).toHaveBeenCalledTimes(1);

    await view.rerender({ fetchWhen: false });
    expect(mockStore.fetchChapters).toHaveBeenCalledTimes(1);

    await view.unmount();
    await renderHook(() => useBindChapterStore('', true));
    expect(mockStore.setDbAndStoryId).toHaveBeenCalledTimes(1);
    expect(mockStore.fetchChapters).toHaveBeenCalledTimes(1);
  });
});
