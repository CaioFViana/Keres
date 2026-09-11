const mockDb = {};
const mockStoryState = { selectedStory: { id: 'story' } };
const mockRows = [{ id: 'story-start', kind: 'story-start' }];
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => selector(mockStoryState)),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChapterAnchorService', () => ({
  __esModule: true,
  createChapterAnchorService: jest.fn(),
}));
jest.mock('../../src/utils/calendarAnchorPreview', () => ({
  __esModule: true,
  buildCalendarAnchorPreview: jest.fn(() => mockRows),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useCalendarAnchorPreview } from '../../src/hooks/useCalendarAnchorPreview';
import { createChapterAnchorService } from '../../src/services/storymanagement/ChapterAnchorService';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { buildCalendarAnchorPreview } from '../../src/utils/calendarAnchorPreview';

const definition = { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockStoryState.selectedStory = { id: 'story' };
  (createChapterService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'chapter' }]),
  });
  (createSceneService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'scene' }]),
  });
  (createChapterAnchorService as jest.Mock).mockReturnValue({
    getAnchorsForStory: jest.fn().mockResolvedValue([{ id: 'anchor' }]),
  });
});

describe('useCalendarAnchorPreview', () => {
  it('loads the three timeline inputs and derives preview rows', async () => {
    const view = await renderHook(() => useCalendarAnchorPreview(definition, true));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await waitFor(() =>
      expect(buildCalendarAnchorPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          story: mockStoryState.selectedStory,
          chapters: [{ id: 'chapter' }],
          scenes: [{ id: 'scene' }],
          anchors: [{ id: 'anchor' }],
          definition,
        }),
      ),
    );
    expect(view.result.current.rows).toBe(mockRows);
  });

  it('does not load when disabled or without a selected story', async () => {
    const disabled = await renderHook(() => useCalendarAnchorPreview(definition, false));
    expect(disabled.result.current).toMatchObject({ rows: mockRows, loading: false });
    expect(createChapterService).not.toHaveBeenCalled();

    mockStoryState.selectedStory = null as never;
    const noStory = await renderHook(() => useCalendarAnchorPreview(definition, true));
    expect(noStory.result.current.rows).toEqual([]);
  });
});
