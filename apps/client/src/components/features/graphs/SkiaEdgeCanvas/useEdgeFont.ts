import { useMemo } from 'react';
import type { SkFont } from '@shopify/react-native-skia';
import { matchEdgeFont } from './matchEdgeFont';

/**
 * Edge-label font: on native the system font, resolved synchronously exactly as before
 * the Skia port (same family, sizes, and weights the `SvgText` labels used). The web
 * twin (`useEdgeFont.web`) loads the bundled Roboto instead - `matchFont` is
 * unimplemented on web - so labels render on every platform. Null stays possible (an
 * unmatchable family); callers skip labels without a font.
 */
export function useEdgeFont(fontSize: number, medium = false): SkFont | null {
  return useMemo(
    () => matchEdgeFont(medium ? { fontSize, fontWeight: '600' } : { fontSize }),
    [fontSize, medium],
  );
}
