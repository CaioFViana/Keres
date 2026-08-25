import avatarIconNames from './avatarIcons.json';

/**
 * A user's avatar: the icons they can choose and the colour shown while they have chosen none.
 *
 * It lives here, rather than in the app, because three places have to agree about it: the app
 * (where the person chooses), the API (which stores `avatarColor`/`avatarIcon`) and the public site
 * (which draws the same avatar for whoever published a story). With the list duplicated, a new icon
 * picked in the app would become an empty square on the site.
 */

/**
 * A small, hand-picked set, not a search across thousands of icons - the request was for a
 * "simple and light" system, and the app uses only Ionicons everywhere else.
 *
 * The names are Ionicons' own: they work both as a font glyph (app) and as an `.svg` file name
 * (site). The list lives in a `.json` next door because the site's build has to read it outside
 * TypeScript - the Vite plugin runs in Node, which does not load this package's `.ts` files.
 */
export const AVATAR_ICON_OPTIONS: readonly string[] = avatarIconNames;

export type AvatarIconName = string;

/** The icon for whoever has not chosen one yet (a freshly created profile). */
export const DEFAULT_AVATAR_ICON = 'person';

/**
 * Fallback colours for whoever has not chosen one. It is the same palette that colours chapters on
 * the Story Map, chosen to work well on both light and dark backgrounds.
 */
export const AVATAR_FALLBACK_PALETTE = [
  '#4F8DF7',
  '#E4713C',
  '#39A867',
  '#B563D6',
  '#D8A22B',
  '#3FA9B8',
  '#D7566F',
  '#7C8CF0',
  '#6FA130',
  '#C4693F',
];

/**
 * A stable colour from a string (an id or a username).
 *
 * Deterministic on purpose: the same person always gets the same colour, in the app and on the site,
 * with nothing written to the database.
 */
export function avatarColorFromSeed(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return AVATAR_FALLBACK_PALETTE[Math.abs(hash) % AVATAR_FALLBACK_PALETTE.length];
}
