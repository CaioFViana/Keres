/**
 * The modes' inheritance rule, in a single place.
 *
 * A mode with no value of its own for a stat reads the normal mode's value. The character's panel, the
 * comparison and the ranking all have to agree about that, so they all go through here instead of each
 * one reimplementing the `??`.
 */

export interface StatValueRow {
  characterId: string;
  modeId: string | null;
  statId: string;
  value: number;
}

export interface ResolvedStatValue {
  value: number | null;
  /** The value came from the normal mode because this mode has none of its own. */
  inherited: boolean;
}

export type StatValueIndex = Map<string, number>;

const keyOf = (characterId: string, modeId: string | null, statId: string) =>
  `${characterId}:${modeId ?? ''}:${statId}`;

/** It indexes the rows once; looking up in a Map is what keeps the ranking and the radar cheap. */
export function indexStatValues(rows: readonly StatValueRow[]): StatValueIndex {
  const index: StatValueIndex = new Map();
  for (const row of rows) index.set(keyOf(row.characterId, row.modeId, row.statId), row.value);
  return index;
}

export function resolveStatValue(
  index: StatValueIndex,
  characterId: string,
  modeId: string | null,
  statId: string,
): ResolvedStatValue {
  const own = index.get(keyOf(characterId, modeId, statId));
  if (own !== undefined) return { value: own, inherited: false };
  if (modeId === null) return { value: null, inherited: false };

  const base = index.get(keyOf(characterId, null, statId));
  return base === undefined ? { value: null, inherited: false } : { value: base, inherited: true };
}

/** Every value of a character in a mode, by statId, with inheritance already applied. */
export function resolveCharacterStats(
  index: StatValueIndex,
  characterId: string,
  modeId: string | null,
  statIds: readonly string[],
): Map<string, ResolvedStatValue> {
  const resolved = new Map<string, ResolvedStatValue>();
  for (const statId of statIds) {
    resolved.set(statId, resolveStatValue(index, characterId, modeId, statId));
  }
  return resolved;
}
