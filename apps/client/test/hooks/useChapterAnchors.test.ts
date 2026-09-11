const mockDb = {};
const mockStoryState = { selectedStory: { type: 'linear' } };
const mockAnchorService = {
  getAnchorsForChapter: jest.fn(),
  createAnchor: jest.fn(),
  updateAnchor: jest.fn(),
  deleteAnchor: jest.fn(),
  nextOrderFor: jest.fn(),
};

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => selector(mockStoryState)),
}));
jest.mock('../../src/services/storymanagement/ChapterAnchorService', () => ({
  __esModule: true,
  createChapterAnchorService: jest.fn(() => mockAnchorService),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChapterAnchors } from '../../src/hooks/useChapterAnchors';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';

const input = {
  startSceneId: 'scene-1',
  startPosition: 'start' as const,
  startOffset: null,
  startOffsetUnit: null,
  endSceneId: null,
  endPosition: null,
  endOffset: null,
  endOffsetUnit: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAnchorService.getAnchorsForChapter.mockResolvedValue([{ id: 'anchor-1' }]);
  mockAnchorService.nextOrderFor.mockResolvedValue(3);
  (createChapterService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest
      .fn()
      .mockResolvedValue([{ id: 'chapter-1', name: 'Opening', index: 1, isDeleted: false }]),
  });
  (createSceneService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([
      { id: 'scene-1', chapterId: 'chapter-1', name: 'Arrival', index: 1, isDeleted: false },
      { id: 'event-scene', chapterId: 'event-1', name: 'Excluded', index: 1, isDeleted: false },
    ]),
  });
});

describe('useChapterAnchors', () => {
  it('loads anchors, content state, and only spine scenes as choices', async () => {
    const view = await renderHook(() => useChapterAnchors('story', 'chapter-1', 'user'));
    await waitFor(() => expect(view.result.current.anchors).toEqual([{ id: 'anchor-1' }]));
    expect(view.result.current).toMatchObject({
      hasContents: true,
      scenes: [{ id: 'scene-1', label: '1. Opening · 1. Arrival' }],
    });
    expect(view.result.current.sceneNames.get('scene-1')).toBe('1. Opening · 1. Arrival');
  });

  it('creates, updates, and deletes anchors before reloading', async () => {
    const view = await renderHook(() => useChapterAnchors('story', 'chapter-1', 'user'));
    await waitFor(() => expect(view.result.current.anchors).toHaveLength(1));
    await act(async () => view.result.current.save(input, null));
    expect(mockAnchorService.createAnchor).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        storyId: 'story',
        chapterId: 'chapter-1',
        order: 3,
        startSceneId: 'scene-1',
      }),
    );

    await act(async () => view.result.current.save(input, 'anchor-1'));
    expect(mockAnchorService.updateAnchor).toHaveBeenCalledWith(
      'user',
      'anchor-1',
      expect.objectContaining({ startSceneId: 'scene-1' }),
    );
    await act(async () => view.result.current.remove('anchor-1'));
    expect(mockAnchorService.deleteAnchor).toHaveBeenCalledWith('user', 'anchor-1');
  });

  it('does not mutate anchors without an actor or start scene', async () => {
    const view = await renderHook(() => useChapterAnchors('story', 'chapter-1', null));
    await waitFor(() => expect(view.result.current.anchors).toHaveLength(1));
    await act(async () => view.result.current.save({ ...input, startSceneId: null }, null));
    await act(async () => view.result.current.remove('anchor-1'));
    expect(mockAnchorService.createAnchor).not.toHaveBeenCalled();
    expect(mockAnchorService.deleteAnchor).not.toHaveBeenCalled();
  });
});
