import {
  formatStatNumber,
  formatStatValueDetailed,
  tierOf,
  type StatNotation,
  type StatTier,
} from '@keres/shared/graphs/statLadder';
import { resolveStatValue, type StatValueIndex } from './statValues';

/**
 * The tier list: everybody in the story sorted by one stat.
 *
 * Each character enters through the normal mode, and each mode enters as a row of its own - that is what
 * you asked for, and it is what allows comparing "Ilda" with "Ilda · In the storm" side by side. In
 * letter notation the rows come out grouped by tier, which is what makes this a tier list and
 * not just a sorted list.
 */

export interface RankingCharacter {
  id: string;
  name: string;
}

export interface RankingMode {
  id: string;
  characterId: string;
  name: string;
}

export interface RankingEntry {
  /** A stable identity for the row, for a list `key`. */
  key: string;
  characterId: string;
  modeId: string | null;
  label: string;
  value: number | null;
  /** The value came from the normal mode because this mode does not have one of its own. */
  inherited: boolean;
  /** The tier and the number together, for when the row appears outside a tier group. */
  display: string;
  /** The number only, for when the group's header already gives the tier. */
  valueDisplay: string;
}

export interface RankingGroup {
  /** The tier's index, or `'none'` for the group of those with no value. */
  key: string;
  /** The tier's label; `null` in numeric mode, which does not group. */
  label: string | null;
  entries: RankingEntry[];
}

export interface StatRankingInput {
  characters: readonly RankingCharacter[];
  modes: readonly RankingMode[];
  values: StatValueIndex;
  statId: string;
  ladder: readonly StatTier[];
  notation: StatNotation;
  direction: 'asc' | 'desc';
  /** It hides the mode rows that merely repeat the normal mode's value. */
  hideInherited?: boolean;
}

const compareByName = (a: RankingEntry, b: RankingEntry) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });

export function buildStatRanking(input: StatRankingInput): RankingGroup[] {
  const { characters, modes, values, statId, ladder, notation, direction } = input;
  const characterById = new Map(characters.map((character) => [character.id, character]));

  const entries: RankingEntry[] = [];
  for (const character of characters) {
    const base = resolveStatValue(values, character.id, null, statId);
    entries.push({
      key: `${character.id}:`,
      characterId: character.id,
      modeId: null,
      label: character.name,
      value: base.value,
      inherited: false,
      display: formatStatValueDetailed(base.value, ladder, notation),
      valueDisplay: formatStatNumber(base.value),
    });
  }
  for (const mode of modes) {
    const owner = characterById.get(mode.characterId);
    if (!owner) continue; // A mode of a character that is not on the list (deleted, for instance).
    const resolved = resolveStatValue(values, mode.characterId, mode.id, statId);
    if (input.hideInherited && resolved.inherited) continue;
    entries.push({
      key: `${mode.characterId}:${mode.id}`,
      characterId: mode.characterId,
      modeId: mode.id,
      label: `${owner.name} · ${mode.name}`,
      value: resolved.value,
      inherited: resolved.inherited,
      display: formatStatValueDetailed(resolved.value, ladder, notation),
      valueDisplay: formatStatNumber(resolved.value),
    });
  }

  const rated = entries.filter((entry) => entry.value !== null);
  const unrated = entries.filter((entry) => entry.value === null).sort(compareByName);

  rated.sort((a, b) => {
    const difference = (b.value as number) - (a.value as number);
    if (difference !== 0) return direction === 'desc' ? difference : -difference;
    return compareByName(a, b);
  });

  const groups: RankingGroup[] = [];
  if (notation === 'letter' && ladder.length > 0) {
    // One group per tier, in the same order as the list - from the top down when descending.
    const byTier = new Map<number, RankingEntry[]>();
    for (const entry of rated) {
      const index = tierOf(entry.value as number, ladder)?.index ?? 0;
      const bucket = byTier.get(index) ?? [];
      bucket.push(entry);
      byTier.set(index, bucket);
    }
    const indexes = [...byTier.keys()].sort((a, b) => (direction === 'desc' ? b - a : a - b));
    for (const index of indexes) {
      groups.push({
        key: String(index),
        label: ladder[index]?.label ?? '',
        entries: byTier.get(index)!,
      });
    }
  } else if (rated.length > 0) {
    groups.push({ key: 'all', label: null, entries: rated });
  }

  if (unrated.length > 0) groups.push({ key: 'none', label: null, entries: unrated });

  return groups;
}
