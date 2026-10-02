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
