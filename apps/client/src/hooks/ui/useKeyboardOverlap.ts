import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, View } from 'react-native';
import { Keyboard, Platform } from 'react-native';

/**
 * True below a container that already lifts itself clear of the keyboard (`ResponsiveModal`), so a
 * `KeyboardAwareScreen` inside it does not make room a second time.
 */
export const KeyboardHandledContext = createContext(false);

/** Below this the keyboard is not covering anything: rounding noise from two measurements. */
const NOISE = 2;
/** The window of a modal can finish resizing well after the keyboard event: measure again after it. */
const REMEASURE_DELAYS = [0, 120, 320];

/**
 * How many dp of a container's bottom the keyboard is covering right now, measured instead of
 * assumed.
 *
 * `KeyboardAvoidingView` infers it from its own frame and the keyboard's, and inside a `Modal`
 * - a window of its own, which on Android edge-to-edge may or may not shrink for the keyboard,
 * depending on the OS version and the OEM - that inference lands on either side of the truth: the
 * composer stays under the keyboard, or it is lifted twice. The container is measured in window
 * coordinates against the keyboard's top, so a window that did resize reads as "nothing covered"
 * and one that did not reads as exactly the keyboard's height. Attach `ref` and `onLayout` to a
 * container that fills the window and pad it by `overlap`: the padding never changes the
 * container's own bounds, so there is no measure-pad-measure loop.
 */
export function useKeyboardOverlap(active: boolean) {
  const ref = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);
  const keyboardTop = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);

  const measure = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      setOverlap(0);
      return;
    }
    // The view's own method: it stays quiet when the native view is gone (the modal closed).
    ref.current?.measureInWindow?.((_x, y, _width, height) => {
      if (!mounted.current || keyboardTop.current === null) return;
      const covered = Math.round(y + height - keyboardTop.current);
      setOverlap(covered > NOISE ? covered : 0);
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!active || Platform.OS === 'web') return;
    const clearTimers = () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
    };
    const handleShow = (event: KeyboardEvent) => {
      keyboardTop.current = event.endCoordinates?.screenY ?? null;
      clearTimers();
      timers.current = REMEASURE_DELAYS.map((delay) => setTimeout(measure, delay));
    };
    const handleHide = () => {
      keyboardTop.current = null;
      clearTimers();
      setOverlap(0);
    };
    // A modal opened over a keyboard that is already up never gets the "show" event.
    const current = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    if (current?.screenY) {
      keyboardTop.current = current.screenY;
      timers.current = REMEASURE_DELAYS.map((delay) => setTimeout(measure, delay));
    }
    const ios = Platform.OS === 'ios';
    const subscriptions = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', handleShow),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', handleHide),
    ];
    return () => {
      mounted.current = false;
      clearTimers();
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [active, measure]);

  // Nothing is covered for a container that is not watching, whatever was measured last.
  return { ref, overlap: active ? overlap : 0, onLayout: measure };
}
