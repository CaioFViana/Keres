import mapIconNames from './mapIcons.json';

/**
 * Icons a Location Map point can carry - a thematic, hand-picked set (places, transport, nature,
 * services) instead of a search across thousands of icons, the same discipline as the avatar list.
 *
 * The names are Ionicons' own: they work both as a font glyph (app) and as an `.svg` file name
 * (Showcase under `apps/admin`). The list lives in a `.json` next door because the Showcase build
 * has to read it outside TypeScript - the Vite plugin runs in Node, which does not load this
 * package's `.ts` files.
 */
export const MAP_ICON_OPTIONS: readonly string[] = mapIconNames;

export type MapIconName = string;

/**
 * Which icon family a stored map-icon name belongs to. Plain names are Ionicons (and
 * stay valid as `.svg` file names for the Showcase build); the `ion:` prefix says the
 * same explicitly, `keres:` reserves names for the future Keres SVG pack, and anything
 * else renders as the fallback glyph instead of guessing.
 */
export type MapIconFamily = 'ion' | 'keres' | 'unknown';

export interface ResolvedMapIcon {
  family: MapIconFamily;
  /** The glyph within its family (`ion:flag` and `flag` both resolve to `flag`). */
  glyph: string;
}

export function resolveMapIcon(name: string): ResolvedMapIcon {
  const separator = name.indexOf(':');
  if (separator < 0) return { family: 'ion', glyph: name };
  const family = name.slice(0, separator);
  const glyph = name.slice(separator + 1);
  if (family === 'ion' || family === 'keres') return { family, glyph };
  return { family: 'unknown', glyph: name };
}
