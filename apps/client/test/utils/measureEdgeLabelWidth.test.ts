import type { SkFont } from '@shopify/react-native-skia';
import { measureEdgeLabelWidth } from '../../src/components/features/graphs/SkiaEdgeCanvas/measureEdgeLabelWidth';

describe('measureEdgeLabelWidth', () => {
  it('sums the glyph advances', () => {
    const font = {
      getGlyphIDs: (text: string) => [...text].map((_, index) => index),
      getGlyphWidths: (ids: number[]) => ids.map((id) => 5 + id),
    } as unknown as SkFont;

    expect(measureEdgeLabelWidth(font, 'go', 10)).toBe(11);
    expect(measureEdgeLabelWidth(font, '', 10)).toBe(0);
  });

  it('falls back to a per-character estimate when glyphs are unavailable', () => {
    const font = {
      getGlyphIDs: () => {
        throw new Error('Not implemented on React Native Web');
      },
      getGlyphWidths: () => {
        throw new Error('Not implemented on React Native Web');
      },
    } as unknown as SkFont;

    expect(measureEdgeLabelWidth(font, 'go', 10)).toBe(2 * 10 * 0.6);
    expect(measureEdgeLabelWidth(font, '', 10)).toBe(0);
  });
});
