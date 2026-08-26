/**
 * A stat's ladder of values and the conversion of a value into a position on the chart.
 *
 * Each rung stores only its own floor; its range is `[minValue, next one's floor[`. That means the
 * whole ladder comes from sorting the rungs, and that moving a rung never leaves a hole between two
 * others.
 *
 * Pure on purpose (no React, no database, no platform), like the app's graph layouts.
 */

export interface StatTier {
  /** Present when the rung already exists in the database; absent while it is being created on screen. */
  id?: string;
  label: string;
  minValue: number;
}

/** How much of the radius, beyond the last ring, the overshoot band takes up. */
export const OVERSHOOT_RATIO = 0.2;

/**
 * Label of the implicit rung that opens the ladder at zero. It sits in a constant because the
 * translation auditor reads every literal `label: '...'` as an i18n key (see
 * `verify-translations.ts`), and this one is drawing text, not a key.
 */
const IMPLICIT_TIER_LABEL = '—';

/** What is shown in place of a value that does not exist. */
const EMPTY_VALUE = '—';

export type StatNotation = 'letter' | 'number';

/**
 * Ordena os degraus e garante que a escada abra no zero: sem um degrau em 0, todo valor abaixo
 * do primeiro piso ficaria fora de qualquer intervalo.
 */
export function sortLadder(tiers: readonly StatTier[]): StatTier[] {
  const sorted = [...tiers].sort((a, b) => a.minValue - b.minValue);
  if (sorted.length === 0 || sorted[0]!.minValue > 0) {
    // The implicit rung has no id: it does not exist in the database, it only closes the gap down to zero.
    sorted.unshift({ label: IMPLICIT_TIER_LABEL, minValue: 0 });
  }
  return sorted;
}

/**
 * The ladder that applies to a stat: its own, when it has one, otherwise the story's default.
 * `strengths` is the raw list for the whole story (default ladder and overrides mixed together).
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
  /** Index of the rung that contains the value. */
  index: number;
  label: string;
  /** Position within the rung, from 0 (at the floor) to 1 (at the next one's floor). */
  fraction: number;
  /** The value went past the last rung. */
  isOverflow: boolean;
}

/** Which rung a value falls on, and how close it is to reaching the next one. */
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
    // Last rung: it has no ceiling, so the fraction uses the previous rung's width as its unit. On a
    // one-rung ladder there is no width to measure at all.
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
 * The radius (0 at the centre, 1 at the outer ring) a value occupies on the radar.
 *
 * With floors `c0=0 < c1 < … < cn`, ring *k* sits at `k/n` and a value in `[ck, ck+1[` sits at
 * `(k + fraction) / n`. Above `cn` the drawing enters the overshoot band: a whole rung beyond the
 * top fills the entire band, and from there up it clamps to its edge.
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

/** How the value is shown to the reader: the rung's label, or the number itself. */
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
 * The rung's label followed by the number, which is what reading a character needs: the tier says
 * the range, the number says where inside it. In numeric notation there is no tier to show, so the
 * number is all that remains.
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
 * The rung's label alone, to be shown beside the field telling which rank the typed number landed
 * on - the question a ladder with arbitrary floors (F at 0, C at 50, A at 400) does not answer on
 * its own. It applies in both notations: in the numeric one the label is the rung's floor, which
 * still says something the typed number does not. Going past the last rung becomes `S+`, the same
 * thing the ruler's dashed band shows in the drawing.
 */
export function formatTierLabel(value: number | null, ladder: readonly StatTier[]): string {
  if (value === null) return EMPTY_VALUE;
  const tier = tierOf(value, ladder);
  if (!tier) return EMPTY_VALUE;
  return tier.isOverflow ? `${tier.label}+` : tier.label;
}

/** Only the number, for when the tier is already stated elsewhere (the ranking's header). */
export function formatStatNumber(value: number | null): string {
  return value === null ? EMPTY_VALUE : formatNumber(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Builds a regular numeric ladder ("from 0 to 100 in steps of 10"). In numeric mode the label is
 * the floor itself, so the same table serves both notations and the drawing has a single path.
 */
export function generateNumericLadder(min: number, max: number, step: number): StatTier[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    throw new Error('A numeric ladder needs finite bounds and step.');
  }
  if (step <= 0) throw new Error('The step of a numeric ladder must be greater than zero.');
  if (max <= min) throw new Error('The top of a numeric ladder must be above its base.');
  if (min < 0) throw new Error('A numeric ladder cannot start below zero.');

  const tiers: StatTier[] = [];
  // Tolerance against accumulated floating-point error on fractional steps (0.1 and the like).
  const epsilon = step / 1000;
  for (let floor = min; floor <= max + epsilon; floor += step) {
    const rounded = Number(floor.toFixed(6));
    tiers.push({ label: formatNumber(rounded), minValue: rounded });
  }
  return sortLadder(tiers);
}
