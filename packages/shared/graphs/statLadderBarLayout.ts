import { formatStatNumber, OVERSHOOT_RATIO, type StatTier } from './statLadder';

/**
 * Geometry of the tier ruler: a bar from 0 to the highest rung's floor, with a mark at each rung
 * and, optionally, the position of the character's value.
 *
 * The axis here is **numeric**, not one rung per equal slice as on the radar. They answer different
 * questions: the radar compares characters across axes (each ring is a rung), the ruler shows the
 * shape of the ladder itself while the author types a number. With F at 0, C at 50 and A at 400, it
 * is the ruler that makes it visible that C is a narrow band and A is almost the whole bar.
 *
 * Pure on purpose, like the app's other layouts.
 */

export interface LadderBarSegment {
  x: number;
  width: number;
  /** Índice do degrau, para alternar o preenchimento e manter a leitura das faixas. */
  index: number;
  label: string;
}

export interface LadderBarMarker {
  x: number;
  label: string;
  /** The label fits without touching the neighbour already drawn. */
  showLabel: boolean;
}

export interface LadderBarValue {
  x: number;
  display: string;
  /** The value went past the last rung and is drawn in the overshoot band. */
  isOverflow: boolean;
}

export interface StatLadderBarLayout {
  width: number;
  /** Onde termina a escada; depois disso vem a faixa de transbordo. */
  ladderWidth: number;
  segments: LadderBarSegment[];
  /** The band beyond the ladder's top, drawn separately so it does not pass through a rung. */
  overflow: { x: number; width: number };
  markers: LadderBarMarker[];
  value: LadderBarValue | null;
}

export interface StatLadderBarInput {
  ladder: readonly StatTier[];
  /** The character's value, or `null` when there is not one yet. */
  value: number | null;
  width: number;
  /** Average width of a label character, to decide what fits. */
  characterWidth?: number;
  /** Margin the value marker must not enter, so its drawing is not cut off. */
  inset?: number;
}

const DEFAULT_CHARACTER_WIDTH = 6.2;
/** Minimum breathing room between two neighbouring labels. */
const LABEL_GAP = 6;

/**
 * `null` when there is no ruler to draw: a ladder with a single rung (or none) has no band to
 * show, and a ladder whose top is zero has no axis.
 */
export function buildStatLadderBar(input: StatLadderBarInput): StatLadderBarLayout | null {
  const { ladder, value, width } = input;
  if (ladder.length < 2 || width <= 0) return null;

  const top = ladder[ladder.length - 1]!.minValue;
  if (top <= 0) return null;

  const characterWidth = input.characterWidth ?? DEFAULT_CHARACTER_WIDTH;
  // The overshoot band takes up the same proportion as the radar's extra radius, so both drawings
  // tell the same story about "above the scale".
  const ladderWidth = width / (1 + OVERSHOOT_RATIO);
  const positionOf = (raw: number) => (Math.max(0, raw) / top) * ladderWidth;

  const segments: LadderBarSegment[] = ladder.map((tier, index) => {
    const start = positionOf(tier.minValue);
    const next = ladder[index + 1];
    // The last rung is where the ladder ends: the overshoot band is drawn separately, otherwise the bar
    // would look like it runs to the end and nobody would see where the top is.
    const end = next ? positionOf(next.minValue) : ladderWidth;
    return { x: start, width: Math.max(0, end - start), index, label: tier.label };
  });

  /**
   * Where the label actually takes up space.
   *
   * The ends are not drawn centred - the first one goes from the mark to the right and the last one
   * to the left, otherwise both would spill out of the bar. The collision arithmetic has to use the
   * same rule as the drawing: assuming everything is centred made the second-to-last and the last
   * overlap on a numeric ladder ("90" glued to "100").
   */
  const labelExtent = (index: number, x: number, label: string) => {
    const full = label.length * characterWidth;
    if (index === 0) return { start: x, end: x + full };
    if (index === ladder.length - 1) return { start: x - full, end: x };
    return { start: x - full / 2, end: x + full / 2 };
  };

  // Labels from left to right, skipping the ones that would touch the last drawn. Both ends always
  // go in: they are what say where the ladder starts and where it ends.
  let lastLabelEnd = Number.NEGATIVE_INFINITY;
  const markers: LadderBarMarker[] = ladder.map((tier, index) => {
    const x = positionOf(tier.minValue);
    const extent = labelExtent(index, x, tier.label);
    const isEnd = index === 0 || index === ladder.length - 1;
    const showLabel = isEnd || extent.start >= lastLabelEnd + LABEL_GAP;
    if (showLabel) lastLabelEnd = extent.end;
    return { x, label: tier.label, showLabel };
  });

  // The last one wins: whoever was accepted before it and would end up underneath is dropped.
  const lastIndex = markers.length - 1;
  if (lastIndex > 0) {
    const lastStart = labelExtent(
      lastIndex,
      markers[lastIndex]!.x,
      markers[lastIndex]!.label,
    ).start;
    for (let index = lastIndex - 1; index > 0; index -= 1) {
      const marker = markers[index]!;
      if (!marker.showLabel) continue;
      if (labelExtent(index, marker.x, marker.label).end + LABEL_GAP > lastStart) {
        marker.showLabel = false;
      } else break;
    }
  }

  const inset = input.inset ?? 0;
  const clamp = (x: number) => Math.min(width - inset, Math.max(inset, x));

  return {
    width,
    ladderWidth,
    segments,
    overflow: { x: ladderWidth, width: width - ladderWidth },
    markers,
    value:
      value === null
        ? null
        : {
            x: clamp(Math.min(width, positionOf(value))),
            display: formatStatNumber(value),
            isOverflow: value > top,
          },
  };
}
