const mockDb = {};
const mockT = (key: string) => key;
const mockStoryState: any = {
  selectedStory: { id: 'story-1', title: 'Story', timelineEpochDay: 0, timelineEpochSeconds: 0 },
  activeArcId: null,
};
const mockSettings = { dateDisplayFormat: 'DD/MM/YYYY' };
const mockNotify = jest.fn();
const mockChapterService = { getAllByStoryId: jest.fn() };
const mockSceneService = { getAllByStoryId: jest.fn() };
const mockAnchorService = { getAnchorsForStory: jest.fn() };
const mockDeliver = jest.fn();
const mockRender = jest.fn();

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => selector(mockStoryState)),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn((selector) => selector(mockSettings)),
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: jest.fn((selector) => selector({ showNotification: mockNotify })),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: jest.fn(() => ({
    colors: {
      background: '#000',
      surface: '#111',
      text: '#fff',
      textSecondary: '#ccc',
      border: '#333',
    },
  })),
}));
jest.mock('../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: jest.fn(() => ({ definition: null, calendars: [], describeDay: jest.fn() })),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(() => mockChapterService),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(() => mockSceneService),
}));
jest.mock('../../src/services/storymanagement/ChapterAnchorService', () => ({
  __esModule: true,
  createChapterAnchorService: jest.fn(() => mockAnchorService),
}));
jest.mock('../../src/utils/storyArcFilter', () => ({
  __esModule: true,
  chapterBelongsToArc: jest.fn(() => true),
  sceneBelongsToActiveArc: jest.fn(() => true),
}));
jest.mock('../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildStoryTimelineFileName: jest.fn(() => 'Story.svg'),
  deliverSvgMap: (...args: unknown[]) => mockDeliver(...args),
}));
jest.mock('@keres/shared/graphs/storyTimelineLayout', () => ({
  __esModule: true,
  buildStoryTimelineLayout: jest.fn((scenes) => ({
    rows: scenes.map((scene: any, index: number) => ({
      id: scene.id,
      elapsedSeconds: index * 86400,
    })),
  })),
}));
jest.mock('@keres/shared/graphs/storyTimelineSvg', () => ({
  __esModule: true,
  renderStoryTimelineSvg: (...args: unknown[]) => mockRender(...args),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryTimeline } from '../../src/hooks/useStoryTimeline';

beforeEach(() => {
  jest.clearAllMocks();
  mockChapterService.getAllByStoryId.mockImplementation(async (_story: string, type: string) =>
    type === 'event'
      ? [{ id: 'event-1', type: 'event', index: 1, name: 'Event', isDeleted: false }]
      : [{ id: 'chapter-1', type: 'chapter', index: 1, name: 'Chapter', isDeleted: false }],
  );
  mockSceneService.getAllByStoryId.mockResolvedValue([
    {
      id: 'scene-1',
      chapterId: 'chapter-1',
      index: 1,
      name: 'Scene',
      gap: 0,
      gapType: 'days',
      duration: 1,
      durationType: 'days',
      isDeleted: false,
    },
  ]);
  mockAnchorService.getAnchorsForStory.mockResolvedValue([]);
  mockRender.mockReturnValue('<svg />');
  mockDeliver.mockResolvedValue({ delivered: true, fileName: 'Story.svg' });
});

describe('useStoryTimeline', () => {
  it('loads visible narrative data and derives dates from timeline rows', async () => {
    const view = await renderHook(() => useStoryTimeline());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({
      chapters: [{ id: 'chapter-1' }],
      scenes: [{ id: 'scene-1' }],
      events: [{ id: 'event-1' }],
      chapterIds: ['chapter-1'],
    });
    expect(view.result.current.dateForRow(0)).toEqual(expect.stringContaining('00:00'));
    expect(view.result.current.describeSceneDay('scene-1')).toEqual(
      expect.objectContaining({ moons: [] }),
    );
  });

  it('updates display controls and exports the built timeline', async () => {
    const view = await renderHook(() => useStoryTimeline());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => {
      view.result.current.setScaleMode('proportional');
      view.result.current.setShowSceneNames(true);
      view.result.current.setShowEvents(false);
    });
    await act(async () => view.result.current.exportTimeline());
    expect(mockRender).toHaveBeenCalled();
    expect(mockDeliver).toHaveBeenCalledWith('<svg />', 'Story.svg');
    expect(mockNotify).toHaveBeenCalledWith('story_timeline_export_success', 'success');
  });
});
