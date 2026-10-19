/**
 * Pricing display for the landing build's tiers section.
 *
 * `yearlyDiscountPercent` mirrors `tierPricing.ts` in `@keres/shared` (used by the admin
 * panel): this package ships without that dependency, so the six lines live here too. Keep the
 * two in sync - both are tested.
 */

/** Whole percent the yearly price saves over twelve months, or null when there is none. */
export function yearlyDiscountPercent(
  priceMonthlyCents: number | null | undefined,
  priceYearlyCents: number | null | undefined,
): number | null {
  if (
    typeof priceMonthlyCents !== 'number' ||
    typeof priceYearlyCents !== 'number' ||
    priceMonthlyCents <= 0 ||
    priceYearlyCents < 0
  ) {
    return null;
  }
  const fullYear = priceMonthlyCents * 12;
  if (priceYearlyCents >= fullYear) {
    return null;
  }
  return Math.round((1 - priceYearlyCents / fullYear) * 100);
}

/** Minor units (1990) in `currency` for `locale`, with a plain fallback. */
export function formatPrice(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${units[index]}`;
}
