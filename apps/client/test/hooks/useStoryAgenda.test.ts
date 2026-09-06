const mockStoryState: {
  selectedStory: { timelineEpochDay: number | null; timelineEpochSeconds: number };
} = { selectedStory: { timelineEpochDay: 100, timelineEpochSeconds: 0 } };
const mockTimeline = {
  loading: false,
  scenes: [{ id: 'scene-1', summary: 'Opening' }],
  layout: {
    rows: [{ id: 'scene-1', name: 'Scene', elapsedSeconds: 86_400, barStart: 10 }],
    eventSpans: [
      { id: 'event-1', name: 'Event', isEvent: true, start: 10 },
      { id: 'event-1', name: 'Event', isEvent: true, start: 20 },
      { id: 'ordinary', name: 'Ordinary', isEvent: false, start: 0 },
    ],
  },
};

jest.mock('@keres/shared', () => ({
  __esModule: true,
  dayNumberForElapsed: jest.fn((_definition, epoch, elapsed) => epoch + elapsed / 86_400),
  gregorianDayNumberForElapsed: jest.fn((epoch, elapsed) => epoch + elapsed / 86_400),
}));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => selector(mockStoryState)),
}));
jest.mock('../../src/hooks/useStoryTimeline', () => ({
  __esModule: true,
  useStoryTimeline: jest.fn(() => mockTimeline),
}));

import { renderHook } from '@testing-library/react-native';
import { useStoryAgenda } from '../../src/hooks/useStoryAgenda';

describe('useStoryAgenda', () => {
  it('derives sorted scene and unique event entries from the shared timeline', async () => {
    const view = await renderHook(() => useStoryAgenda());
    expect(view.result.current).toEqual({
      loading: false,
      entries: [
        { id: 'scene-1', name: 'Scene', kind: 'scene', dayNumber: 101, summary: 'Opening' },
        { id: 'event-1', name: 'Event', kind: 'event', dayNumber: 101 },
      ],
    });
  });

  it('remains empty when the story has no timeline epoch', async () => {
    mockStoryState.selectedStory = { timelineEpochDay: null, timelineEpochSeconds: 0 };
    const view = await renderHook(() => useStoryAgenda());
    expect(view.result.current.entries).toEqual([]);
  });
});
