import keresIconManifest from './keresIcons.json';

/**
 * The Keres icon pack: genre icons (kingdoms, war, magic, sci-fi...) vendored from
 * game-icons.net (CC BY 3.0, see `keres/NOTICE.md`) for everything Ionicons does not
 * cover. Stored names carry the `keres:` namespace (`resolveMapIcon`); the manifest
 * lives in JSON because the Showcase build reads it outside TypeScript, like the
 * other icon lists.
 */
export const KERES_ICON_CATEGORIES = [
  'kingdoms',
  'adventure',
  'war',
  'magic',
  'creatures',
  'sea',
  'terrain',
  'scifi-places',
  'scifi-tech',
  'mystery',
] as const;

export type KeresIconCategory = (typeof KERES_ICON_CATEGORIES)[number];

export interface KeresIconEntry {
  /** Keres name (`keres:castle` on the wire); the SVG file is `<name>.svg`. */
  name: string;
  /** Upstream author, for the credits screen. */
  author: string;
  /** Upstream slug (`author/file`) the file was vendored from. */
  source: string;
  category: KeresIconCategory;
  /** English search synonyms; the name itself always matches. */
  keywords: readonly string[];
}

export const KERES_ICONS: readonly KeresIconEntry[] =
  keresIconManifest as readonly KeresIconEntry[];

/** Plain Keres names, mirroring `MAP_ICON_OPTIONS`. */
export const KERES_ICON_OPTIONS: readonly string[] = KERES_ICONS.map((entry) => entry.name);
