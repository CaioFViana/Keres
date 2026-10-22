import { renderHook } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import { usePanResponder } from '@/src/hooks/ui/usePanResponder';

type Config = Record<string, (...args: unknown[]) => unknown>;

const event = {};
const gesture = { dx: 4 };

describe('usePanResponder', () => {
  let create: jest.SpyInstance;

  beforeEach(() => {
    create = jest.spyOn(PanResponder, 'create');
  });

  afterEach(() => {
    create.mockRestore();
  });

  const lastConfig = () => create.mock.calls[create.mock.calls.length - 1][0] as Config;

  it('creates the responder once and keeps it across renders', async () => {
    const view = await renderHook(
      ({ step }: { step: number }) => usePanResponder({ onPanResponderMove: () => step }),
      { initialProps: { step: 1 } },
    );
    const first = view.result.current;

    await view.rerender({ step: 2 });
    await view.rerender({ step: 3 });

    expect(create).toHaveBeenCalledTimes(1);
    expect(view.result.current).toBe(first);
    expect(view.result.current.panHandlers).toBe(first.panHandlers);
  });

  it('passes the handlers of the first render by name, and no others', async () => {
    await renderHook(() =>
      usePanResponder({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: () => undefined,
      }),
    );

    expect(Object.keys(lastConfig()).sort()).toEqual([
      'onPanResponderMove',
      'onStartShouldSetPanResponder',
    ]);
  });

  it('calls the handler of the latest render, with its arguments and its answer', async () => {
    const seen: unknown[] = [];
    const view = await renderHook(
      ({ step }: { step: number }) =>
        usePanResponder({
          onMoveShouldSetPanResponder: () => step > 1,
          onPanResponderMove: (_event, state) => {
            seen.push([step, state.dx]);
          },
        }),
      { initialProps: { step: 1 } },
    );
    const config = lastConfig();
    expect(config.onMoveShouldSetPanResponder(event, gesture)).toBe(false);

    await view.rerender({ step: 2 });

    expect(config.onMoveShouldSetPanResponder(event, gesture)).toBe(true);
    config.onPanResponderMove(event, gesture);
    expect(seen).toEqual([[2, 4]]);
  });

  it('answers nothing for a handler that a later render no longer has', async () => {
    const view = await renderHook(
      ({ on }: { on: boolean }) =>
        usePanResponder({ onStartShouldSetPanResponder: on ? () => true : undefined }),
      { initialProps: { on: true } },
    );
    const config = lastConfig();
    expect(config.onStartShouldSetPanResponder(event, gesture)).toBe(true);

    await view.rerender({ on: false });

    expect(config.onStartShouldSetPanResponder(event, gesture)).toBeUndefined();
  });
});
