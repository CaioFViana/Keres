export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Turns dates that became strings (`JSON.parse`, or the static import of a packaged `.json`)
 * back into `Date`.
 *
 * The story export schemas (`FullStoryExportSchema` and friends) use `z.date()`, which
 * rejects a string - without this, re-importing a `.json`/`.zip` exported by this very app, or
 * installing a packaged example story, would fail validation before even trying to
 * write anything to the database, because `JSON.stringify` always serializes a `Date` as an ISO
 * string and nothing deliberately converts it back.
 */
export function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(reviveDates) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = reviveDates(entryValue);
    }
    return result as T;
  }
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
    return new Date(value) as unknown as T;
  }
  return value;
}
