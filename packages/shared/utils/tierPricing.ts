/**
 * The yearly discount a tier advertises, derived from its two prices - never stored, so the
 * two inputs cannot disagree with it. `null` when there is no yearly offer to compare, when
 * the monthly price is missing, or when the yearly price is not actually cheaper.
 *
 * `apps/site` keeps its own copy: that package ships without `@keres/shared` (no zod in the
 * landing bundle), so it cannot import this. Keep the two in sync - both are tested.
 */
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
