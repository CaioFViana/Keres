export type StorageUnit = 'B' | 'KB' | 'MB' | 'GB';

/** Largest first: the unit a size is shown in is the first one that holds it without a remainder. */
const UNIT_FACTORS: ReadonlyArray<readonly [StorageUnit, number]> = [
  ['GB', 1024 ** 3],
  ['MB', 1024 ** 2],
  ['KB', 1024],
  ['B', 1],
];

export const STORAGE_UNITS: readonly StorageUnit[] = ['B', 'KB', 'MB', 'GB'];

export function unitFactor(unit: StorageUnit): number {
  return UNIT_FACTORS.find(([name]) => name === unit)![1];
}

/**
 * A size in bytes as an amount and the unit that states it exactly (1_572_864 is 1.5 MB, which is
 * 1536 KB: the amount stays whole so what is edited is what is stored). Empty is no limit.
 */
export function splitBytes(bytes: number | null): { amount: number | null; unit: StorageUnit } {
  if (bytes === null || bytes === 0) return { amount: bytes, unit: 'MB' };
  const [unit, factor] = UNIT_FACTORS.find(([, f]) => bytes % f === 0) ?? ['B', 1];
  return { amount: bytes / factor, unit };
}

/** The other way: the amount typed and the unit chosen, rounded to the byte. */
export function toBytes(amount: number | null, unit: StorageUnit): number | null {
  return amount === null ? null : Math.round(amount * unitFactor(unit));
}

export function formatStorage(bytes: number | null): string {
  if (bytes === null) return '∞';
  const { amount, unit } = splitBytes(bytes);
  return `${amount} ${unit}`;
}
