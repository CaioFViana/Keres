import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTweenedRect } from '../../src/guides/useTweenedRect';

const a = { x: 0, y: 100, width: 100, height: 40 };
const b = { x: 200, y: 500, width: 300, height: 80 };

describe('useTweenedRect', () => {
  it('starts on the rect it is given', async () => {
    const { result } = await renderHook(() => useTweenedRect(a));

    expect(result.current).toEqual(a);
  });

  it('shows a hole that appears or goes away at once, without sliding', async () => {
    const { result, rerender } = await renderHook(
      ({ target }: { target: typeof a | null }) => useTweenedRect(target),
      { initialProps: { target: null as typeof a | null } },
    );
    expect(result.current).toBeNull();

    await act(async () => rerender({ target: a }));
    expect(result.current).toEqual(a);

    await act(async () => rerender({ target: null }));
    expect(result.current).toBeNull();
  });

  it('slides from one target to the next and ends exactly on it', async () => {
    const { result, rerender } = await renderHook(
      ({ target }: { target: typeof a }) => useTweenedRect(target, 120),
      { initialProps: { target: a } },
    );

    await act(async () => rerender({ target: b }));
    const frames = new Set<number>();
    const watch = setInterval(() => {
      if (result.current) frames.add(result.current.y);
    }, 5);
    await waitFor(() => expect(result.current).toEqual(b));
    clearInterval(watch);

    // It went through places between the two, not straight to the end.
    expect([...frames].some((y) => y > a.y && y < b.y)).toBe(true);
  });

  it('does not restart for a target with the same numbers in a new object', async () => {
    const { result, rerender } = await renderHook(
      ({ target }: { target: typeof a }) => useTweenedRect(target, 120),
      { initialProps: { target: a } },
    );

    await act(async () => rerender({ target: { ...a } }));

    expect(result.current).toEqual(a);
  });
});
