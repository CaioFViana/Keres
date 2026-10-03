import { KERES_OFFICIAL_URL } from './content/links';

/**
 * Which site this build is.
 *
 * `pages` is the project site on GitHub Pages, as it always was: static, with no server behind
 * it. `landing` is the same code served by a Keres API at its own root, with the tiers, contact
 * and official-server sections that need that API.
 *
 * Set at build time: `vite.landing.config.ts` defines it as `landing`; the default config
 * leaves it unset (pages). Read once, at module load - tests for the landing build stub the
 * variable and re-import.
 */
export type SiteVariant = 'pages' | 'landing';

export const SITE_VARIANT: SiteVariant =
  import.meta.env.VITE_SITE_VARIANT === 'landing' ? 'landing' : 'pages';

export const isLandingBuild = SITE_VARIANT === 'landing';

const OFFICIAL_HOST = new URL(KERES_OFFICIAL_URL).hostname;

/** The official server's own host, with or without `www`. Anything else is a server somebody else runs. */
export const isOfficialHost = (hostname: string): boolean =>
  hostname === OFFICIAL_HOST || hostname === `www.${OFFICIAL_HOST}`;

/**
 * Whether this page is the official Keres service itself: a landing build, served from keres.me.
 * Any other landing build is the front of whichever server its operator runs, and says "this
 * server"; here the same words say "Keres". Only the landing build can be official - the Pages
 * site has no server behind it. Read once, at module load, like the variant.
 */
export const isOfficialSite =
  isLandingBuild && typeof location !== 'undefined' && isOfficialHost(location.hostname);

/**
 * i18next context for the texts that speak of the server hosting the page: with it, `key_official`
 * is read where it exists and the plain `key` everywhere else.
 */
export const SITE_TEXT_CONTEXT: string | undefined = isOfficialSite ? 'official' : undefined;
