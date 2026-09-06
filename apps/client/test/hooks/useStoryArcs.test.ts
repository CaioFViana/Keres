const mockDb = {};
const mockSetActiveArcId = jest.fn();
const mockSetTheme = jest.fn();
const mockStoryState = {
  selectedStory: { id: 'story', theme: 'dark' },
  activeArcId: 'arc-1' as string | null,
  setActiveArcId: mockSetActiveArcId,
};
const mockGetArcsForStory = jest.fn();

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => selector(mockStoryState)),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: jest.fn(() => ({ setTheme: mockSetTheme })),
}));
jest.mock('../../src/services/storymanagement/StoryArcService', () => ({
  __esModule: true,
  createStoryArcService: jest.fn(() => ({ getArcsForStory: mockGetArcsForStory })),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryArcs } from '../../src/hooks/useStoryArcs';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

beforeEach(() => {
  jest.clearAllMocks();
  mockStoryState.selectedStory = { id: 'story', theme: 'dark' };
  mockStoryState.activeArcId = 'arc-1';
  mockGetArcsForStory.mockResolvedValue([
    { id: 'arc-1', name: 'Act one', themeOverride: 'light' },
    { id: 'arc-2', name: 'Act two', themeOverride: null },
  ]);
});

describe('useStoryArcs', () => {
  it('loads arcs, finds the active one, and applies its effective theme', async () => {
    const view = await renderHook(() => useStoryArcs());
    await waitFor(() => expect(view.result.current.arcs).toHaveLength(2));

    expect(mockGetArcsForStory).toHaveBeenCalledWith('story');
    expect(view.result.current).toMatchObject({ activeArc: { id: 'arc-1' }, showSelector: true });
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');
  });

  it('reloads for the active story and clears a stale arc selection', async () => {
    mockGetArcsForStory.mockResolvedValue([{ id: 'arc-2', name: 'Act two', themeOverride: null }]);
    const view = await renderHook(() => useStoryArcs());
    await waitFor(() => expect(mockSetActiveArcId).toHaveBeenCalledWith(null));

    await act(async () => entityEventEmitter.emit('story_arc_changed', 'other-story'));
    expect(mockGetArcsForStory).toHaveBeenCalledTimes(1);
    await act(async () => entityEventEmitter.emit('story_arc_changed', 'story'));
    await waitFor(() => expect(mockGetArcsForStory).toHaveBeenCalledTimes(2));
    expect(view.result.current.showSelector).toBe(false);
  });
});
