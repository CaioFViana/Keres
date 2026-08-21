/**
 * A escada de valores de um status e a conversão de um valor em posição no gráfico.
 *
 * Cada degrau guarda só o próprio piso; o intervalo dele é `[minValue, piso do próximo[`. Isso
 * significa que a escada inteira sai de ordenar os degraus, e que mover um degrau nunca deixa
 * um buraco entre dois outros.
 *
 * Puro de propósito (sem React, sem banco, sem plataforma), como os layouts de grafo do app.
 */

export interface StatTier {
  /** Presente quando o degrau já existe no banco; ausente enquanto está sendo criado na tela. */
  id?: string;
  label: string;
  minValue: number;
}

/** Quanto do raio, além do último anel, a faixa de transbordo ocupa. */
export const OVERSHOOT_RATIO = 0.2;

/**
 * Rótulo do degrau implícito que abre a escada no zero. Fica numa constante porque o auditor de
 * traduções lê todo `label: '...'` literal como chave de i18n (ver `verify-translations.ts`), e
 * este aqui é texto de desenho, não chave.
 */
const IMPLICIT_TIER_LABEL = '—';

/** O que aparece no lugar de um valor que não existe. */
const EMPTY_VALUE = '—';

export type StatNotation = 'letter' | 'number';

/**
 * Ordena os degraus e garante que a escada abra no zero: sem um degrau em 0, todo valor abaixo
 * do primeiro piso ficaria fora de qualquer intervalo.
 */
export function sortLadder(tiers: readonly StatTier[]): StatTier[] {
  const sorted = [...tiers].sort((a, b) => a.minValue - b.minValue);
  if (sorted.length === 0 || sorted[0]!.minValue > 0) {
    // O degrau implícito não tem id: ele não existe no banco, só fecha o vão até o zero.
    sorted.unshift({ label: IMPLICIT_TIER_LABEL, minValue: 0 });
  }
  return sorted;
}

/**
 * A escada que vale para um status: a própria, quando ele tem uma, senão a padrão da história.
 * `strengths` é a lista crua da história inteira (escada padrão e overrides misturados).
 */
export function resolveLadder(
  statId: string,
  strengths: readonly { id?: string; statId: string | null; label: string; minValue: number }[],
): StatTier[] {
  const own = strengths.filter((row) => row.statId === statId);
  const source = own.length > 0 ? own : strengths.filter((row) => row.statId === null);
  return sortLadder(source.map(({ id, label, minValue }) => ({ id, label, minValue })));
}

export interface TierPosition {
  /** Índice do degrau que contém o valor. */
  index: number;
  label: string;
  /** Posição dentro do degrau, de 0 (no piso) a 1 (no piso do próximo). */
  fraction: number;
  /** O valor passou do último degrau. */
  isOverflow: boolean;
}

/** Em que degrau um valor cai, e quão longe está de encostar no próximo. */
export function tierOf(value: number, ladder: readonly StatTier[]): TierPosition | null {
  if (ladder.length === 0) return null;

  let index = 0;
  for (let position = 0; position < ladder.length; position += 1) {
    if (value >= ladder[position]!.minValue) index = position;
    else break;
  }

  const tier = ladder[index]!;
  const next = ladder[index + 1];
  if (!next) {
    // Último degrau: não tem topo, então a fração usa a largura do degrau anterior como
    // unidade. Numa escada de um degrau só não há largura nenhuma para medir.
    const previous = ladder[index - 1];
    const width = previous ? tier.minValue - previous.minValue : 0;
    const excess = value - tier.minValue;
    return {
      index,
      label: tier.label,
      fraction: width > 0 ? excess / width : excess > 0 ? 1 : 0,
      isOverflow: excess > 0,
    };
  }

  const width = next.minValue - tier.minValue;
  return {
    index,
    label: tier.label,
    fraction: width > 0 ? (value - tier.minValue) / width : 0,
    isOverflow: false,
  };
}

/**
 * O raio (0 no centro, 1 no anel externo) que um valor ocupa no radar.
 *
 * Com pisos `c0=0 < c1 < … < cn`, o anel *k* fica em `k/n` e um valor em `[ck, ck+1[` fica em
 * `(k + fração) / n`. Acima de `cn` o desenho entra na faixa de transbordo: um degrau inteiro
 * além do topo preenche a faixa toda, e daí para cima trava na borda dela.
 */
export function normalizeValue(value: number, ladder: readonly StatTier[]): number {
  const position = tierOf(value, ladder);
  if (!position) return 0;

  const intervals = ladder.length - 1;
  if (intervals <= 0) return position.isOverflow ? 1 : 0;

  if (position.isOverflow) {
    return 1 + OVERSHOOT_RATIO * Math.min(1, Math.max(0, position.fraction));
  }
  return Math.min(1, Math.max(0, (position.index + position.fraction) / intervals));
}

/** Como o valor é mostrado ao leitor: o rótulo do degrau, ou o próprio número. */
export function formatStatValue(
  value: number | null,
  ladder: readonly StatTier[],
  notation: StatNotation,
): string {
  if (value === null) return EMPTY_VALUE;
  if (notation === 'number') return formatNumber(value);
  return tierOf(value, ladder)?.label ?? formatNumber(value);
}

/**
 * O rótulo do degrau seguido do número, que é o que a leitura de um personagem precisa: o tier
 * diz a faixa, o número diz onde dentro dela. Na notação numérica não há tier a mostrar, então
 * sobra o próprio número.
 */
export function formatStatValueDetailed(
  value: number | null,
  ladder: readonly StatTier[],
  notation: StatNotation,
): string {
  if (value === null) return EMPTY_VALUE;
  if (notation === 'number') return formatNumber(value);
  const tier = tierOf(value, ladder);
  return tier ? `${tier.label} (${formatNumber(value)})` : formatNumber(value);
}

/**
 * Só o rótulo do degrau, para dizer ao lado do campo em que rank o número digitado caiu - a
 * pergunta que uma escada de pisos arbitrários (F em 0, C em 50, A em 400) não responde sozinha.
 * Vale nas duas notações: na numérica o rótulo é o piso do degrau, que ainda diz algo que o
 * número digitado não diz. Passar do último degrau vira `S+`, o mesmo que a faixa tracejada da
 * régua mostra em desenho.
 */
export function formatTierLabel(value: number | null, ladder: readonly StatTier[]): string {
  if (value === null) return EMPTY_VALUE;
  const tier = tierOf(value, ladder);
  if (!tier) return EMPTY_VALUE;
  return tier.isOverflow ? `${tier.label}+` : tier.label;
}

/** Só o número, para quando o tier já está dito em outro lugar (o cabeçalho do ranking). */
export function formatStatNumber(value: number | null): string {
  return value === null ? EMPTY_VALUE : formatNumber(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Monta uma escada numérica regular ("de 0 a 100 de 10 em 10"). No modo numérico o rótulo é o
 * próprio piso, então a mesma tabela serve às duas notações e o desenho tem um caminho só.
 */
export function generateNumericLadder(min: number, max: number, step: number): StatTier[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    throw new Error('A numeric ladder needs finite bounds and step.');
  }
  if (step <= 0) throw new Error('The step of a numeric ladder must be greater than zero.');
  if (max <= min) throw new Error('The top of a numeric ladder must be above its base.');
  if (min < 0) throw new Error('A numeric ladder cannot start below zero.');

  const tiers: StatTier[] = [];
  // Tolerância contra o acúmulo de erro de ponto flutuante em passos fracionários (0.1 e afins).
  const epsilon = step / 1000;
  for (let floor = min; floor <= max + epsilon; floor += step) {
    const rounded = Number(floor.toFixed(6));
    tiers.push({ label: formatNumber(rounded), minValue: rounded });
  }
  return sortLadder(tiers);
}
