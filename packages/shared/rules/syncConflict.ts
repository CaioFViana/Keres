/** Fields maintained by synchronization rather than chosen by the person resolving a conflict. */
const BOOKKEEPING_FIELDS = new Set([
  'id',
  'storyId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

export function syncConflictValuesDiffer(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (a == null && b == null) return false;
  if (a instanceof Date || b instanceof Date) {
    const timeA = a ? new Date(a as string | Date).getTime() : null;
    const timeB = b ? new Date(b as string | Date).getTime() : null;
    return timeA !== timeB;
  }
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  }
  return true;
}

/**
 * Fields modified locally for which the server also supplied a different value. Fields omitted
 * from a partial remote operation express no opposing intent and therefore merge automatically.
 */
export function findContestedFields(
  localValues: Record<string, unknown>,
  serverValues: Record<string, unknown> | null,
): string[] {
  if (!serverValues) {
    return Object.keys(localValues).filter((key) => !BOOKKEEPING_FIELDS.has(key));
  }
  return Object.keys(localValues)
    .filter((key) => !BOOKKEEPING_FIELDS.has(key))
    .filter((key) => key in serverValues)
    .filter((key) => syncConflictValuesDiffer(localValues[key], serverValues[key]));
}

/** Merges ordered local operation payloads; the last local edit wins for every content field. */
export function mergeLocalOperationPayloads(
  operations: ReadonlyArray<{ payload: string }>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const operation of operations) {
    try {
      const payload = JSON.parse(operation.payload) as Record<string, unknown>;
      for (const [key, value] of Object.entries(payload)) {
        if (!BOOKKEEPING_FIELDS.has(key)) merged[key] = value;
      }
    } catch {
      // A malformed legacy payload has no usable values to contribute.
    }
  }
  return merged;
}
