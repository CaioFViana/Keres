/**
 * How the public landing page presents the plans this server offers. `sale` lists them with prices and
 * a way to buy; `info` lists the same plans and their limits only - no prices, nothing for sale - for a
 * server whose plans are granted by its operator. Plain constants, no zod, so the schema, the database
 * column and the admin panel can all import them by subpath.
 */
export const TIERS_DISPLAYS = ['sale', 'info'] as const;
export type TiersDisplay = (typeof TIERS_DISPLAYS)[number];

/** A server that never set the mode sells its plans, as it always has. */
export const DEFAULT_TIERS_DISPLAY: TiersDisplay = 'sale';
