export interface ReorderItem {
  id: string;
  newIndex: number;
}

/**
 * The final order of a dragged list, in the format synchronization expects: `newIndex`
 * **contiguous 1..N**.
 *
 * The base is not a matter of style. The server refuses a reorder whose lowest index is not 1 or
 * which does not end at N, and the refusal does not show up as an error on screen: it becomes a
 * synchronization conflict, with the new order staying on the device alone. A single function, used
 * by every reorder modal, so that rule does not have to be remembered in each one.
 */
export function buildReorderItems<T>(
  items: readonly T[],
  getId: (item: T) => string,
): ReorderItem[] {
  return items.map((item, position) => ({ id: getId(item), newIndex: position + 1 }));
}

/**
 * What is wrong with a set of reorder indices, or `null` if nothing is.
 *
 * It is the check the server runs when a reorder arrives - it used to be copied into two
 * synchronization handlers, with the same message written twice. On the client side, it is what
 * `buildReorderItems` guarantees by construction; the test for both points here.
 */
export function reorderIndicesProblem(indices: readonly number[]): string | null {
  if (indices.length === 0) return null;
  if (new Set(indices).size !== indices.length) {
    return 'Validation Error: Duplicate newIndex values found in reorder items.';
  }
  if (Math.min(...indices) !== 1 || Math.max(...indices) !== indices.length) {
    return 'Validation Error: New indices must be sequential starting from 1 without gaps.';
  }
  return null;
}
