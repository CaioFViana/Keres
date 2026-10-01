import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';
import { useKeyboardOverlap } from '../../src/hooks/useKeyboardOverlap';

type Handler = (event: { endCoordinates?: { screenY: number } }) => void;

describe('useKeyboardOverlap', () => {
  const original = Platform.OS;
  let handlers: Record<string, Handler>;
  let removed: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    Platform.OS = 'android';
    handlers = {};
    removed = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, handler: Handler) => {
      handlers[name] = handler;
      return { remove: removed };
    }) as never);
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Platform.OS = original;
  });

  /** Puts a container at `bottom` dp (window coordinates) under the hook's ref. */
  const placeAt = (view: { current: unknown }, bottom: number) => {
    view.current = {
      measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
        callback(0, 0, 400, bottom),
    };
  };
  const showKeyboardAt = async (screenY: number) => {
    await act(async () => {
      handlers.keyboardDidShow({ endCoordinates: { screenY } });
      jest.advanceTimersByTime(400);
    });
  };

  it('reports how much of the container the keyboard covers, and nothing once it is gone', async () => {
    const { result } = await renderHook(() => useKeyboardOverlap(true));
    placeAt(result.current.ref, 800);

    await showKeyboardAt(500);
    expect(result.current.overlap).toBe(300);

    await act(async () => handlers.keyboardDidHide({}));
    expect(result.current.overlap).toBe(0);
  });

  it('adds nothing when the window already shrank for the keyboard', async () => {
    const { result } = await renderHook(() => useKeyboardOverlap(true));
    placeAt(result.current.ref, 500);

    await showKeyboardAt(500);

    expect(result.current.overlap).toBe(0);
  });

  it('measures again after the window finishes resizing, so the lift is never doubled', async () => {
    const { result } = await renderHook(() => useKeyboardOverlap(true));
    placeAt(result.current.ref, 800);
    await act(async () => {
      handlers.keyboardDidShow({ endCoordinates: { screenY: 500 } });
      jest.advanceTimersByTime(10);
    });
    expect(result.current.overlap).toBe(300);

    // The window catches up with the keyboard after the first measure.
    placeAt(result.current.ref, 500);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current.overlap).toBe(0);
  });

  it('follows a keyboard that was already up when the container appeared', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({
      screenX: 0,
      screenY: 450,
      width: 400,
      height: 350,
    });
    const { result } = await renderHook(() => useKeyboardOverlap(true));
    placeAt(result.current.ref, 800);

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current.overlap).toBe(350);
  });

  it('listens to nothing while inactive or on the web', async () => {
    await renderHook(() => useKeyboardOverlap(false));
    expect(Keyboard.addListener).not.toHaveBeenCalled();

    Platform.OS = 'web';
    await renderHook(() => useKeyboardOverlap(true));
    expect(Keyboard.addListener).not.toHaveBeenCalled();
  });

  it('stops listening when it goes away', async () => {
    const view = await renderHook(() => useKeyboardOverlap(true));
    await view.unmount();

    expect(removed).toHaveBeenCalledTimes(2);
  });
});
