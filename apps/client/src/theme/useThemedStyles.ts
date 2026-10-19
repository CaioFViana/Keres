import { useMemo } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { ThemeColors } from './index';
import { useTheme } from './index';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/** How many values besides the palette the styles of one component may depend on. */
const MAX_DEPS = 5;

/**
 * The styles of a component that depend on the theme, built once per palette instead of on every render.
 *
 * The factory lives at module level next to the component and the body only says
 * `const styles = useThemedStyles(createStyles)`:
 *
 *     const createStyles = (colors: ThemeColors) => StyleSheet.create({ box: { color: colors.text } });
 *
 * When the styles also depend on other values (a breakpoint, a width, a measured size), pass them as `deps`;
 * the factory receives them as its second argument, so it stays a stable module-level function:
 *
 *     const createStyles = (colors: ThemeColors, [compact]: [boolean]) => StyleSheet.create({ ... });
 *     const styles = useThemedStyles(createStyles, [isCompact]);
 *
 * Up to five values, compared one by one (an object by identity, so keep it stable with `useMemo`).
 *
 * Import it by path (`@/src/theme/useThemedStyles`), not through the theme barrel: tests that mock the barrel's
 * `useTheme` keep working, because the hook reads the palette through that same `useTheme`.
 */
export function useThemedStyles<
  T extends NamedStyles<T>,
  D extends readonly unknown[] = readonly [],
>(createStyles: (colors: ThemeColors, deps: D) => T, deps: D = [] as unknown as D): T {
  const { colors } = useTheme();
  if (deps.length > MAX_DEPS) {
    throw new Error(`useThemedStyles takes at most ${MAX_DEPS} extra values, got ${deps.length}.`);
  }
  // A literal list of fixed length (the count of `deps` never changes for a call site): `deps` is spread over
  // its slots so each value is compared on its own.
  /* eslint-disable react-hooks/exhaustive-deps -- the slots below are `deps`. */
  return useMemo(
    () => createStyles(colors, deps),
    [createStyles, colors, deps[0], deps[1], deps[2], deps[3], deps[4]],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
}
