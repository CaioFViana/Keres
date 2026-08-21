/**
 * A regra de herança dos modos, num lugar só.
 *
 * Um modo que não tem valor próprio para um status lê o valor do modo normal. Painel do
 * personagem, comparação e ranking precisam concordar sobre isso, então todos passam por aqui
 * em vez de cada um reimplementar o `??`.
 */

export interface StatValueRow {
  characterId: string;
  modeId: string | null;
  statId: string;
  value: number;
}

export interface ResolvedStatValue {
  value: number | null;
  /** O valor veio do modo normal porque este modo não tem um próprio. */
  inherited: boolean;
}

export type StatValueIndex = Map<string, number>;

const keyOf = (characterId: string, modeId: string | null, statId: string) =>
  `${characterId}:${modeId ?? ''}:${statId}`;

/** Indexa as linhas uma vez; buscar num Map é o que mantém ranking e radar baratos. */
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

/** Todos os valores de um personagem num modo, por statId, já com a herança aplicada. */
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
