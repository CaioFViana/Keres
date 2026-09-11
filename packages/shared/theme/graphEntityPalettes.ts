import { getDistinctSeriesColor } from '../utils/colorUtils';

/**
 * Theme-aware colours for graph entities (chapters, events, series rows).
 *
 * Light swatches are bright enough that `getContrastTextColor` always picks black
 * (MultiSelectPill labels). Dark swatches are deep enough that it always picks white.
 * Light and dark keep the same hue order so index 0 stays “the blue” across a theme toggle.
 *
 * Wired like `ENTITY_APPEARANCE`: `ThemeProvider` calls `setGraphEntityPaletteScheme`, and
 * helpers below read the active scheme unless an explicit one is passed.
 */

export type GraphEntityPaletteScheme = 'light' | 'dark';

/** Chapter / event band colours on maps, timelines, and related accents. */
export const GRAPH_CHAPTER_PALETTE = {
  light: [
    '#90CAF9',
    '#FFAB91',
    '#A5D6A7',
    '#CE93D8',
    '#FFE082',
    '#80DEEA',
    '#EF9A9A',
    '#9FA8DA',
    '#C5E1A5',
    '#FFCC80',
  ],
  // Bright enough to read as labels/accents on dark surfaces, still dark enough for white pill text.
  dark: [
    '#1976D2',
    '#BF360C',
    '#2E7D32',
    '#7E57C2',
    '#A65D00',
    '#00796B',
    '#C62828',
    '#5C6BC0',
    '#5A7D2A',
    '#8D6E63',
  ],
} as const satisfies Record<GraphEntityPaletteScheme, readonly string[]>;

/** Series colours for presence-matrix / plot-matrix rows (characters, items, plots). */
export const GRAPH_SERIES_PALETTE = {
  light: [
    '#4FC3F7',
    '#EF9A9A',
    '#B39DDB',
    '#FFCC80',
    '#81C784',
    '#F48FB1',
    '#9FA8DA',
    '#BCAAA4',
    '#4DD0E1',
    '#E57373',
    '#90CAF9',
    '#DCE775',
  ],
  dark: [
    '#0277BD',
    '#C62828',
    '#7E57C2',
    '#BF360C',
    '#2E7D32',
    '#D81B60',
    '#5C6BC0',
    '#8D6E63',
    '#00796B',
    '#D32F2F',
    '#1565C0',
    '#5A7D2A',
  ],
} as const satisfies Record<GraphEntityPaletteScheme, readonly string[]>;

let activeScheme: GraphEntityPaletteScheme = 'light';

/** Set once by the host theme provider so layout helpers resolve the same palette as React. */
export function setGraphEntityPaletteScheme(isDarkMode: boolean): void {
  activeScheme = isDarkMode ? 'dark' : 'light';
}

export function getGraphEntityPaletteScheme(): GraphEntityPaletteScheme {
  return activeScheme;
}

export function getChapterPalette(
  scheme: GraphEntityPaletteScheme = activeScheme,
): readonly string[] {
  return GRAPH_CHAPTER_PALETTE[scheme];
}

export function getSeriesPalette(
  scheme: GraphEntityPaletteScheme = activeScheme,
): readonly string[] {
  return GRAPH_SERIES_PALETTE[scheme];
}

/**
 * Distinct series colour for charts. Uses the theme palette while there is room;
 * larger comparisons fall back to `getDistinctSeriesColor`'s wheel (best-effort contrast).
 */
export function graphSeriesColor(
  index: number,
  total: number,
  scheme: GraphEntityPaletteScheme = activeScheme,
): string {
  return getDistinctSeriesColor(index, total, getSeriesPalette(scheme));
}
