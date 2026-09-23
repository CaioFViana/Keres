import type { Ionicons } from '@expo/vector-icons';
import { resolveMapIcon } from '@keres/shared';

/**
 * The Ionicons glyph for a stored map-icon name: Ionicons names render as-is, while
 * `keres:`, unknown-namespace and empty names fall back to `location` - the pack and
 * its renderer arrive later, but stored data already reserves the namespace.
 */
export function mapIconGlyph(name: string | null | undefined): keyof typeof Ionicons.glyphMap {
  const resolved = resolveMapIcon(name ?? '');
  const glyph = resolved.family === 'ion' && resolved.glyph ? resolved.glyph : 'location';
  return glyph as keyof typeof Ionicons.glyphMap;
}
