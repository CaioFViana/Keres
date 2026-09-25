/**
 * Identity of the released version of Keres.
 *
 * `bun run version:set <version> <name>` updates ONLY the `name` and `version` fields below -
 * the edit is surgical, and everything else in this file is hand-owned and survives releases.
 * This module is consumed by both the client and the API, so there is no separate server version.
 */
export const APP_RELEASE = {
  name: 'Aion',
  version: '1.8.0',
  /**
   * The release's line, shown verbatim on the credits screen. English, never translated - it is
   * the release's voice, quoted from `docs/fluff_release_names.md`. Update it by hand with every
   * release (see `docs/release_process.md`).
   */
  phrase:
    'Locked in place by the eternal serpent, the young main exists surrounded by the zodiac. Never ending, never starting, always present, always cycling.',
} as const;

/** Where the source lives; the credits screen links out to it. */
export const KERES_REPOSITORY_URL = 'https://github.com/CaioFViana/Keres';

/** Keres' own license, shown on the credits screen next to the repository link. */
export const KERES_LICENSE = {
  name: 'Mozilla Public License 2.0',
  shortName: 'MPL-2.0',
  url: 'https://www.mozilla.org/MPL/2.0/',
} as const;

export interface ReleaseCreditAuthor {
  name: string;
  url: string;
}

export interface ReleaseCredit {
  /** The upstream project, as credited. */
  project: string;
  projectUrl: string;
  license: string;
  licenseUrl: string;
  authors: readonly ReleaseCreditAuthor[];
  /**
   * Client translation key for a note rendered under the entry. Adaptation disclosures and the
   * like are interface prose and therefore translated, unlike the names above.
   */
  noteKey?: string;
}

/**
 * Third-party work bundled with the app, for the credits screen.
 *
 * The game-icons.net authors mirror `keresIcons.json`'s `author` field - pinned by
 * `test/metadata/appRelease.test.ts`, so vendoring an icon from a new author fails loudly
 * instead of shipping without credit.
 */
export const THIRD_PARTY_CREDITS: readonly ReleaseCredit[] = [
  {
    project: 'game-icons.net',
    projectUrl: 'https://game-icons.net',
    license: 'Creative Commons Attribution 3.0 Unported (CC BY 3.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    authors: [
      { name: 'Lorc', url: 'http://lorcblog.blogspot.com' },
      { name: 'Delapouite', url: 'https://delapouite.com' },
      { name: 'Carl Olsen', url: 'https://twitter.com/unstoppableCarl' },
      { name: 'Skoll', url: 'https://game-icons.net' },
    ],
    noteKey: 'credits_game_icons_note',
  },
  {
    project: 'Ionicons',
    projectUrl: 'https://github.com/ionic-team/ionicons',
    license: 'MIT License',
    licenseUrl: 'https://opensource.org/license/mit',
    authors: [{ name: 'Ionic Team', url: 'https://ionic.io' }],
  },
  {
    project: 'Roboto',
    projectUrl: 'https://fonts.google.com/specimen/Roboto',
    license: 'Apache License 2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    authors: [{ name: 'Christian Robertson', url: 'https://fonts.google.com/specimen/Roboto' }],
  },
];
