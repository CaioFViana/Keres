import type { SkFont } from '@shopify/react-native-skia';

/** Mean Roboto advance per character, in ems; last-resort estimate only (see below). */
const ESTIMATE_ADVANCE_EM = 0.6;

/**
 * Label advance width. `measureText` is the obvious call, but it is unimplemented on web
 * (`throwNotImplementedOnRNWeb`) - and it throws during render, which blanks the whole
 * overlay. Glyph advances are bound on both platforms (native C++ `JsiSkFont` plus the
 * web `JsiSkFont`), and summing here also sidesteps the native `getTextWidth`, whose
 * integer accumulator truncates every glyph. The per-character estimate is the last
 * resort, so measurement alone can never kill the edges.
 */
export function measureEdgeLabelWidth(font: SkFont, text: string, fontSize: number): number {
  try {
    return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((total, width) => total + width, 0);
  } catch {
    return text.length * fontSize * ESTIMATE_ADVANCE_EM;
  }
}
