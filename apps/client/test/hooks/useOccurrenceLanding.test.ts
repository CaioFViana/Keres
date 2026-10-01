import { renderHook } from '@testing-library/react-native';
import type { ScrollView } from 'react-native';
import React from 'react';
import {
  OccurrenceLandingContext,
  useOccurrenceFlash,
  useOccurrenceLandingController,
} from '../../src/hooks/useOccurrenceLanding';
import type { OccurrenceTarget } from '../../src/utils/occurrenceTarget';

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

describe('useOccurrenceLandingController', () => {
  it('scrolls the occurrence into view with a comfort margin', async () => {
    const scrollTo = jest.fn();
    const { result } = await renderHook(() => useOccurrenceLandingController(null));
    result.current.scrollRef.current = {
      ...measured([[0, 0, 400, 800]]),
      scrollTo,
    } as unknown as ScrollView;
    result.current.handleScroll({ nativeEvent: { contentOffset: { y: 100 } } });

    result.current.access.requestScroll(measured([[0, 900, 100, 20]]));
    jest.advanceTimersByTime(20);

    // Viewport 0..800, margin 96: the host ends at 920, so the list moves down
    // by 920 - (800 - 96), on top of the tracked offset.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 316, animated: true });
  });

  it('leaves the list alone when the occurrence already sits in view', async () => {
    const scrollTo = jest.fn();
    const { result } = await renderHook(() => useOccurrenceLandingController(null));
    result.current.scrollRef.current = {
      ...measured([[0, 0, 400, 800]]),
      scrollTo,
    } as unknown as ScrollView;

    result.current.access.requestScroll(measured([[0, 200, 100, 20]]));
    jest.advanceTimersByTime(20);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('retries once when the host has not laid out yet', async () => {
    const scrollTo = jest.fn();
    const { result } = await renderHook(() => useOccurrenceLandingController(null));
    result.current.scrollRef.current = {
      ...measured([[0, 0, 400, 800]]),
      scrollTo,
    } as unknown as ScrollView;

    result.current.access.requestScroll(
      measured([
        [0, 0, 100, 0],
        [0, 900, 100, 20],
      ]),
    );
    jest.advanceTimersByTime(20);
    expect(scrollTo).not.toHaveBeenCalled();

    jest.advanceTimersByTime(120);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('drops the previous request once a newer one arrives', async () => {
    const scrollTo = jest.fn();
    const { result } = await renderHook(() => useOccurrenceLandingController(null));
    result.current.scrollRef.current = {
      ...measured([[0, 0, 400, 800]]),
      scrollTo,
    } as unknown as ScrollView;

    // The stale host measures zeros first (schedules the 120ms retry), then would
    // report a segment above the viewport: without the generation guard, the late
    // retry would yank the list back after the fresh data lands.
    result.current.access.requestScroll(
      measured([
        [0, 0, 100, 0],
        [0, -500, 100, 100],
      ]),
    );
    jest.advanceTimersByTime(20);

    result.current.access.requestScroll(measured([[0, 900, 100, 20]]));
    jest.advanceTimersByTime(20);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 216, animated: true });

    jest.advanceTimersByTime(500);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe('useOccurrenceFlash', () => {
  const renderFlash = (
    fieldKey: string | undefined,
    value: string,
    target: OccurrenceTarget | null,
  ) =>
    renderHook(() => useOccurrenceFlash(fieldKey, value), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          OccurrenceLandingContext.Provider,
          { value: { target, requestScroll: () => {} } },
          children,
        ),
    });

  it('locates the needle while the flash is on', async () => {
    const { result } = await renderFlash('biography', 'Alice went home.', {
      field: 'biography',
      needle: 'home',
    });

    expect(result.current.targeted).toBe(true);
    expect(result.current.flashRanges).toEqual([{ start: 11, length: 4 }]);
  });

  it('reports no ranges when untargeted or needle-less', async () => {
    const wrong = await renderFlash('biography', 'Alice went home.', {
      field: 'description',
      needle: 'home',
    });
    expect(wrong.result.current.targeted).toBe(false);
    expect(wrong.result.current.flashRanges).toEqual([]);

    const noNeedle = await renderFlash('biography', 'Alice went home.', { field: 'biography' });
    expect(noNeedle.result.current.targeted).toBe(true);
    expect(noNeedle.result.current.flashRanges).toEqual([]);
  });
});
