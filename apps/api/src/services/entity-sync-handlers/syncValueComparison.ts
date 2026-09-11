/** Compares JSON-compatible sync values structurally, independent of object key order. */
export function syncValuesMatch(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    const leftTime = left instanceof Date ? left.getTime() : new Date(String(left)).getTime();
    const rightTime = right instanceof Date ? right.getTime() : new Date(String(right)).getTime();
    return leftTime === rightTime;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => syncValuesMatch(value, right[index]))
    );
  }
  if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && syncValuesMatch(leftRecord[key], rightRecord[key]),
      )
    );
  }
  return (left ?? null) === (right ?? null);
}
