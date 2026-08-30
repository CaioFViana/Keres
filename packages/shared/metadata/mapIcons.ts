import mapIconNames from './mapIcons.json';

/**
 * Icons a Location Map point can carry - a thematic, hand-picked set (places, transport, nature,
 * services) instead of a search across thousands of icons, the same discipline as the avatar list.
 *
 * The names are Ionicons' own: they work both as a font glyph (app) and as an `.svg` file name
 * (site). The list lives in a `.json` next door because the site's build has to read it outside
 * TypeScript - the Vite plugin runs in Node, which does not load this package's `.ts` files.
 */
export const MAP_ICON_OPTIONS: readonly string[] = mapIconNames;

export type MapIconName = string;
