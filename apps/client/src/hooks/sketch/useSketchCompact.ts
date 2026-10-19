import { useWindowDimensions } from 'react-native';

/**
 * Below this width the sketch folds its tools into menus and squeezes its options onto one row.
 * Wider than the app's `compact` breakpoint on purpose: the full toolbar is about 850 px of
 * buttons, so a small tablet in portrait is still too narrow for it.
 */
export const SKETCH_COMPACT_WIDTH = 900;

export function useSketchCompact(): boolean {
  return useWindowDimensions().width < SKETCH_COMPACT_WIDTH;
}
