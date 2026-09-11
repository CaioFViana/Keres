const mockDb = {};
const mockStoryState = { selectedStory: { timelineEpochDay: 0, timelineEpochSeconds: 0 } };
const mockSettings = { dateDisplayFormat: 'DD/MM/YYYY' };
const mockSceneService = { getAllByStoryId: jest.fn() };
const mockChapterService = { getAllByStoryId: jest.fn() };

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => selector(mockStoryState)),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn((selector) => selector(mockSettings)),
}));
jest.mock('../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: jest.fn(() => ({ definition: null })),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(() => mockSceneService),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(() => mockChapterService),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => Promise<void>) => React.useEffect(() => void load(), [load]),
  };
});

import { renderHook, waitFor } from '@testing-library/react-native';
import { useSceneCalendarDates } from '../../src/hooks/useSceneCalendarDates';

beforeEach(() => {
  jest.clearAllMocks();
  mockSceneService.getAllByStoryId.mockResolvedValue([
    {
      id: 'scene-1',
      chapterId: 'chapter-1',
      index: 1,
      gap: 0,
      gapType: 'days',
      duration: 1,
      durationType: 'days',
      isDeleted: false,
    },
    {
      id: 'scene-2',
      chapterId: 'chapter-1',
      index: 2,
      gap: 1,
      gapType: 'days',
      duration: 0,
      durationType: 'days',
      isDeleted: false,
    },
  ]);
  mockChapterService.getAllByStoryId.mockResolvedValue([
    { id: 'chapter-1', index: 1, isDeleted: false },
  ]);
});

describe('useSceneCalendarDates', () => {
  it('builds dates, duration ranges, and scene gaps from the story spine', async () => {
    const view = await renderHook(() => useSceneCalendarDates('story-1'));
    await waitFor(() => expect(mockSceneService.getAllByStoryId).toHaveBeenCalledWith('story-1'));
    const first = view.result.current.dateForScene({
      id: 'scene-1',
      duration: 1,
      durationType: 'days',
    });
    const second = view.result.current.dateForScene({
      id: 'scene-2',
      duration: 0,
      durationType: 'days',
    });
    expect(first).toEqual(
      expect.objectContaining({ date: expect.any(String), durationEnd: expect.any(String) }),
    );
    expect(second).toEqual(
      expect.objectContaining({ date: expect.any(String), gapRange: expect.any(String) }),
    );
  });

  it('returns no date when the scene is absent or the story has no epoch', async () => {
    const view = await renderHook(() => useSceneCalendarDates('story-1'));
    await waitFor(() => expect(mockChapterService.getAllByStoryId).toHaveBeenCalled());
    expect(
      view.result.current.dateForScene({ id: 'missing', duration: 0, durationType: 'days' }),
    ).toBeNull();
    mockStoryState.selectedStory = { timelineEpochDay: null, timelineEpochSeconds: 0 } as never;
    const noEpoch = await renderHook(() => useSceneCalendarDates('story-1'));
    expect(
      noEpoch.result.current.dateForScene({ id: 'scene-1', duration: 0, durationType: 'days' }),
    ).toBeNull();
  });
});
