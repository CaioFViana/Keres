import { getContrastTextColor } from '../utils/colorUtils';
import type { ThemeColors } from './ThemeColors';

/**
 * Foreground colour for content drawn on a theme fill.
 * Prefers the matching `on*` token; falls back to black/white by WCAG contrast.
 */
export function getOnColorForFill(colors: ThemeColors, fill: string | undefined): string {
  if (!fill || fill === colors.primary) return colors.onPrimary;
  if (fill === colors.secondary) return colors.onSecondary;
  if (fill === colors.error) return colors.onError;
  if (fill === colors.accent) return colors.onAccent;
  if (fill === colors.notification) return colors.onNotification;
  if (fill === colors.primaryContainer) return colors.onPrimaryContainer;
  return getContrastTextColor(fill) === 'white' ? '#FFFFFF' : '#1A1A1A';
}
