import { afterEach, describe, expect, it } from 'vitest';
import {
  GRAPH_CHAPTER_PALETTE,
  GRAPH_SERIES_PALETTE,
  getChapterPalette,
  getGraphEntityPaletteScheme,
  getSeriesPalette,
  graphSeriesColor,
  setGraphEntityPaletteScheme,
} from '../../theme/graphEntityPalettes';
import { getContrastRatio, getContrastTextColor } from '../../utils/colorUtils';

/** Typical app dark surface — dark swatches are also used as text/accents on it. */
const DARK_SURFACE = '#121212';

describe('graphEntityPalettes', () => {
  afterEach(() => {
    setGraphEntityPaletteScheme(false);
  });

  it('keeps light and dark chapter palettes the same length and hue order', () => {
    expect(GRAPH_CHAPTER_PALETTE.light).toHaveLength(GRAPH_CHAPTER_PALETTE.dark.length);
    expect(GRAPH_SERIES_PALETTE.light).toHaveLength(GRAPH_SERIES_PALETTE.dark.length);
  });

  it('uses black pill text on every light swatch and white on every dark swatch', () => {
    for (const color of [...GRAPH_CHAPTER_PALETTE.light, ...GRAPH_SERIES_PALETTE.light]) {
      expect(getContrastTextColor(color)).toBe('black');
    }
    for (const color of [...GRAPH_CHAPTER_PALETTE.dark, ...GRAPH_SERIES_PALETTE.dark]) {
      expect(getContrastTextColor(color)).toBe('white');
    }
  });

  it('keeps dark swatches readable as accents on a dark surface', () => {
    for (const color of [...GRAPH_CHAPTER_PALETTE.dark, ...GRAPH_SERIES_PALETTE.dark]) {
      expect(getContrastRatio(color, DARK_SURFACE)!).toBeGreaterThanOrEqual(3);
    }
  });

  it('follows setGraphEntityPaletteScheme like entity appearance', () => {
    setGraphEntityPaletteScheme(false);
    expect(getGraphEntityPaletteScheme()).toBe('light');
    expect(getChapterPalette()).toBe(GRAPH_CHAPTER_PALETTE.light);
    expect(getSeriesPalette()).toBe(GRAPH_SERIES_PALETTE.light);

    setGraphEntityPaletteScheme(true);
    expect(getGraphEntityPaletteScheme()).toBe('dark');
    expect(getChapterPalette()).toBe(GRAPH_CHAPTER_PALETTE.dark);
    expect(getSeriesPalette()).toBe(GRAPH_SERIES_PALETTE.dark);
  });

  it('allows an explicit scheme override without changing the active one', () => {
    setGraphEntityPaletteScheme(false);
    expect(getChapterPalette('dark')).toBe(GRAPH_CHAPTER_PALETTE.dark);
    expect(getGraphEntityPaletteScheme()).toBe('light');
  });

  it('picks series colours from the active palette while there is room', () => {
    setGraphEntityPaletteScheme(false);
    expect(graphSeriesColor(0, 3)).toBe(GRAPH_SERIES_PALETTE.light[0]);
    setGraphEntityPaletteScheme(true);
    expect(graphSeriesColor(1, 3)).toBe(GRAPH_SERIES_PALETTE.dark[1]);
  });
});
