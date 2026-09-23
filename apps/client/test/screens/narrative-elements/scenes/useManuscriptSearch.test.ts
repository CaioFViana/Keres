import { renderHook } from '@testing-library/react-native';
import type { FlatList, Text, View } from 'react-native';
import type { ManuscriptSection } from '@keres/shared';
import { useManuscriptSearch } from '../../../../src/screens/narrative-elements/scenes/useManuscriptSearch';

const sections: ManuscriptSection[] = [
  {
    key: 'scene-a',
    kind: 'scene',
    scene: {
      id: 'a',
      chapterId: null,
      name: 'Alpha',
      index: 1,
      body: 'First body.',
      isDeleted: false,
    },
    position: 1,
  },
];

type MeasureCallback = (x: number, y: number, width: number, height: number) => void;

function measured(frames: [number, number, number, number][]) {
  let calls = 0;
  return {
    measureInWindow: jest.fn((callback: MeasureCallback) => {
      callback(...frames[Math.min(calls, frames.length - 1)]);
      calls += 1;
    }),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useManuscriptSearch fine scroll', () => {
  it('drops the previous hit retry once a newer hit attaches', async () => {
    const scrollToOffset = jest.fn();
    const listRef = { current: { scrollToOffset } } as unknown as React.RefObject<
      FlatList<ManuscriptSection> | null
    >;
    const { result } = await renderHook(() => useManuscriptSearch(sections, listRef, jest.fn()));
    result.current.viewportRef.current = measured([[0, 0, 400, 800]]) as unknown as View;

    // The stale host measures zeros first (schedules the 120ms retry), then reports
    // a segment above the viewport: without the generation guard, the late retry
    // would yank the list back after the navigation.
    const stale = measured([
      [0, 0, 100, 0],
      [0, -500, 100, 100],
    ]) as unknown as Text;
    result.current.scrollActiveIntoView(stale);
    jest.advanceTimersByTime(20);

    const fresh = measured([[0, 900, 100, 20]]) as unknown as Text;
    result.current.scrollActiveIntoView(fresh);
    jest.advanceTimersByTime(20);

    // Viewport 0..800, margin 96: the fresh segment ends at 920, so the list moves
    // down by exactly 920 - (800 - 96).
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 216, animated: true });

    jest.advanceTimersByTime(500);
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
  });
});
