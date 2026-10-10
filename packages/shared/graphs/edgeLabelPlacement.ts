import { round } from './graphLayoutShared';
import type { GraphPoint } from './storyGraphLayout';

/**
 * Where the label of a straight edge goes. The label sits on the line, in a plate drawn under the
 * nodes, so a plate that reaches a node is half hidden by it, and two plates on top of each other
 * read as one. The layout does not know the font, so it works with an estimate of the plate that
 * errs on the wide side; the canvas draws the plate from the measured text.
 */

/** Labels longer than this are cut with an ellipsis where they are drawn. */
export const EDGE_LABEL_MAX_CHARS = 22;
export const EDGE_LABEL_HEIGHT = 16;
const EDGE_LABEL_CHAR_WIDTH = 5.6;
const EDGE_LABEL_AIR = 12;
/** Space kept between a plate and whatever it must not touch. */
const PLATE_MARGIN = 3;
/** Along the line, as a fraction from its start: the middle first, then alternately to either side. */
const SLIDE_POSITIONS = [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75, 0.2, 0.8];
const GRID_CELL = 128;

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelledSegment {
  id: string;
  label: string;
  start: GraphPoint;
  end: GraphPoint;
}

/** The width of a label's plate: its text, cut at the maximum, plus air. Zero for an empty label. */
export function estimateEdgeLabelWidth(label: string): number {
  const chars = Math.min(label.trim().length, EDGE_LABEL_MAX_CHARS);
  return chars === 0 ? 0 : chars * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_AIR;
}

/** The plate of a label centred on a point. */
export function edgeLabelRect(center: GraphPoint, label: string): LabelRect {
  const width = estimateEdgeLabelWidth(label);
  return {
    x: center.x - width / 2,
    y: center.y - EDGE_LABEL_HEIGHT / 2,
    width,
    height: EDGE_LABEL_HEIGHT,
  };
}

function overlaps(a: LabelRect, b: LabelRect): boolean {
  return (
    a.x < b.x + b.width + PLATE_MARGIN &&
    b.x < a.x + a.width + PLATE_MARGIN &&
    a.y < b.y + b.height + PLATE_MARGIN &&
    b.y < a.y + a.height + PLATE_MARGIN
  );
}

/** Rectangles bucketed by cell, so a plate is only compared with the ones near it. */
class RectGrid {
  private readonly cells = new Map<string, LabelRect[]>();

  add(rect: LabelRect): void {
    this.forCells(rect, (key) => {
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(rect);
      else this.cells.set(key, [rect]);
    });
  }

  /** How many rectangles in the grid the plate overlaps. */
  countOverlaps(rect: LabelRect): number {
    const seen = new Set<LabelRect>();
    this.forCells(rect, (key) => {
      for (const other of this.cells.get(key) ?? []) {
        if (overlaps(rect, other)) seen.add(other);
      }
    });
    return seen.size;
  }

  private forCells(rect: LabelRect, visit: (key: string) => void): void {
    const x0 = Math.floor((rect.x - PLATE_MARGIN) / GRID_CELL);
    const x1 = Math.floor((rect.x + rect.width + PLATE_MARGIN) / GRID_CELL);
    const y0 = Math.floor((rect.y - PLATE_MARGIN) / GRID_CELL);
    const y1 = Math.floor((rect.y + rect.height + PLATE_MARGIN) / GRID_CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) visit(`${x}:${y}`);
  }
}

/**
 * The point on each segment where its label goes. The middle of the line when nothing is in the
 * way; otherwise the nearest spot along the line where the plate touches no node and no plate placed
 * before it - or, when the line is crowded everywhere, the spot with the fewest collisions.
 * Segments are placed in the order given, so the result is the same for the same map.
 */
export function placeEdgeLabels(
  segments: readonly LabelledSegment[],
  nodes: readonly LabelRect[],
): Map<string, GraphPoint> {
  const blockers = new RectGrid();
  for (const node of nodes) blockers.add(node);

  const placed = new Map<string, GraphPoint>();
  for (const segment of segments) {
    const at = (fraction: number): GraphPoint => ({
      x: round(segment.start.x + (segment.end.x - segment.start.x) * fraction),
      y: round(segment.start.y + (segment.end.y - segment.start.y) * fraction),
    });

    if (estimateEdgeLabelWidth(segment.label) === 0) {
      placed.set(segment.id, at(0.5));
      continue;
    }

    let best = at(SLIDE_POSITIONS[0]);
    let bestCount = Number.POSITIVE_INFINITY;
    for (const fraction of SLIDE_POSITIONS) {
      const point = at(fraction);
      const count = blockers.countOverlaps(edgeLabelRect(point, segment.label));
      if (count < bestCount) {
        best = point;
        bestCount = count;
      }
      if (count === 0) break;
    }
    placed.set(segment.id, best);
    blockers.add(edgeLabelRect(best, segment.label));
  }
  return placed;
}

/** Whether the plate of a label at the middle of a segment keeps clear of both boxes it joins. */
export function labelFitsBetween(
  segment: LabelledSegment,
  source: LabelRect,
  target: LabelRect,
): boolean {
  const middle = {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
  const plate = edgeLabelRect(middle, segment.label);
  if (plate.width === 0) return true;
  return !overlaps(plate, source) && !overlaps(plate, target);
}
