import { useMemo } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { ThemeColors } from './index';
import { useTheme } from './index';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * The styles of a component that depend on the theme, built once per palette instead of on every render.
 *
 * The factory lives at module level next to the component and the body only says
 * `const styles = useThemedStyles(createStyles)`:
 *
 *     const createStyles = (colors: ThemeColors) => StyleSheet.create({ box: { color: colors.text } });
 *
 * When the styles also depend on other values (a breakpoint, a width), pass them as `deps`; the factory
 * receives them as its second argument, so it stays a stable module-level function:
 *
 *     const createStyles = (colors: ThemeColors, [compact]: [boolean]) => StyleSheet.create({ ... });
 *     const styles = useThemedStyles(createStyles, [isCompact]);
 *
 * Import it by path (`@/src/theme/useThemedStyles`), not through the theme barrel: tests that mock the barrel's
 * `useTheme` keep working, because the hook reads the palette through that same `useTheme`.
 */
export function useThemedStyles<T extends NamedStyles<T>, D extends readonly unknown[] = []>(
  createStyles: (colors: ThemeColors, deps: D) => T,
  deps: D = [] as unknown as D,
): T {
  const { colors } = useTheme();
  // The caller's `deps` are the other values the styles read; the factory itself is module-level.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createStyles(colors, deps), [createStyles, colors, ...deps]);
}
