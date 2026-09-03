export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Restores ISO timestamps that JSON serialization turns from `Date` objects into strings. */
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
