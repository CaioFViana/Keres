import {
  formatStatNumber,
  formatStatValueDetailed,
  tierOf,
  type StatNotation,
  type StatTier,
} from './statLadder';
import { resolveStatValue, type StatValueIndex } from './statValues';

/**
 * A tier list: todo mundo da história ordenado por um status.
 *
 * Cada personagem entra pelo modo normal, e cada modo entra como uma linha própria - foi o que
 * você pediu, e é o que permite comparar "Ilda" com "Ilda · Na tempestade" lado a lado. Na
 * notação de letras as linhas saem agrupadas por degrau, que é o que faz disso uma tier list e
 * não só uma lista ordenada.
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
  /** Identidade estável da linha, para `key` de lista. */
  key: string;
  characterId: string;
  modeId: string | null;
  label: string;
  value: number | null;
  /** O valor veio do modo normal porque este modo não tem um próprio. */
  inherited: boolean;
  /** Tier e número juntos, para quando a linha aparece fora de um grupo de tier. */
  display: string;
  /** Só o número, para quando o cabeçalho do grupo já diz o tier. */
  valueDisplay: string;
}

export interface RankingGroup {
  /** Índice do degrau, ou `'none'` para o grupo de quem não tem valor. */
  key: string;
  /** Rótulo do degrau; `null` no modo numérico, que não agrupa. */
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
  /** Esconde as linhas de modo que apenas repetem o valor do modo normal. */
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
    if (!owner) continue; // Modo de um personagem que não está na lista (apagado, por exemplo).
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
    // Um grupo por degrau, na mesma ordem da lista - do topo para a base quando decrescente.
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
