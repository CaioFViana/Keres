import { useFont } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import mediumAsset from '@/assets/fonts/Roboto-Medium.ttf';
import regularAsset from '@/assets/fonts/Roboto-Regular.ttf';
import { matchEdgeFont } from './matchEdgeFont';

/**
 * Edge-label and overlay-label font: the bundled Roboto, the same file on every platform (the web
 * twin, `useEdgeFont.web`, loads it through `expo-asset`). Matching a system font by family
 * (`matchFont`) drew nothing on some Android devices - shape labels and connection labels stayed
 * invisible while the shapes themselves were fine - because a match can succeed with a typeface
 * that has no glyphs to draw. A font the app ships cannot be missing. The system match stays as the
 * fallback while the bundled one loads (or should it never load); null stays possible, and callers
 * skip labels without a font.
 */
export function useEdgeFont(fontSize: number, medium = false): SkFont | null {
  const bundled = useFont(medium ? mediumAsset : regularAsset, fontSize);
  const system = useMemo(
    () => matchEdgeFont(medium ? { fontSize, fontWeight: '600' } : { fontSize }),
    [fontSize, medium],
  );
  return bundled ?? system;
}
