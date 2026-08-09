import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints shared by the client UI. They describe the amount of space
 * available to the content, rather than a particular device model.
 */
export const RESPONSIVE_BREAKPOINTS = {
  medium: 768,
  wide: 1100,
} as const;

export type ResponsiveBreakpoint = 'compact' | 'medium' | 'wide';

export function getResponsiveBreakpoint(width: number): ResponsiveBreakpoint {
  if (width >= RESPONSIVE_BREAKPOINTS.wide) {
    return 'wide';
  }
  if (width >= RESPONSIVE_BREAKPOINTS.medium) {
    return 'medium';
  }
  return 'compact';
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const breakpoint = getResponsiveBreakpoint(width);

  return {
    width,
    height,
    breakpoint,
    isCompact: breakpoint === 'compact',
    isMedium: breakpoint === 'medium',
    isWide: breakpoint === 'wide',
  };
}

