export interface ReorderItem {
  id: string;
  newIndex: number;
}

export type ContiguousIndexProblem = 'duplicate' | 'start' | 'gap';

/**
 * Inspects persisted display indices rather than a reorder request. It lets maintenance tools and
 * story analysis describe the same corrupt 1..N sequence before either asks the sync protocol to
 * repair it.
 */
export function inspectContiguousOneBasedIndexes(
  indexes: readonly number[],
): ContiguousIndexProblem | null {
  if (indexes.length === 0) return null;
  const sorted = [...indexes].sort((a, b) => a - b);
  if (new Set(sorted).size !== sorted.length) return 'duplicate';
  if (sorted[0] !== 1) return 'start';
  return sorted.every((value, position) => value === position + 1) ? null : 'gap';
}

/**
 * The final order of a dragged list as the reorder services take it: `newIndex` contiguous 1..N,
 * built here once so no modal has to remember the base. The services turn it into rank edits of
 * the rows that moved (`rules/rank.ts`).
 */
export function buildReorderItems<T>(
  items: readonly T[],
  getId: (item: T) => string,
): ReorderItem[] {
  return items.map((item, position) => ({ id: getId(item), newIndex: position + 1 }));
}
