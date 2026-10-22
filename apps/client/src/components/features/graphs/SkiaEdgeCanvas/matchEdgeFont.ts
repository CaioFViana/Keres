import { matchFont } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { logger } from '@/src/utils/logging/logger';

let warned = false;

/**
 * `matchFont`, but total: on web `matchFamilyStyle` is unimplemented and throws ("Not
 * implemented on React Native Web"), and a device that cannot match the family must never
 * blank a canvas. Callers render labels only when this returns a font and treat null as
 * "edges without labels".
 */
export function matchEdgeFont(style?: Parameters<typeof matchFont>[0]): SkFont | null {
  try {
    return matchFont(style) ?? null;
  } catch {
    if (!warned) {
      warned = true;
      logger.warn('[SkiaEdgeCanvas] system font unavailable on this platform; edge labels hidden.');
    }
    return null;
  }
}
