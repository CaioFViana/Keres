import { describe, expect, it } from 'vitest';
import {
  EDGE_LABEL_MAX_CHARS,
  edgeLabelRect,
  estimateEdgeLabelWidth,
  labelFitsBetween,
  placeEdgeLabels,
} from '../../graphs/edgeLabelPlacement';

const segment = (id: string, label: string, x1: number, y1: number, x2: number, y2: number) => ({
  id,
  label,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
});

describe('estimateEdgeLabelWidth', () => {
  it('is zero for an empty label and grows with the text', () => {
    expect(estimateEdgeLabelWidth('')).toBe(0);
    expect(estimateEdgeLabelWidth('   ')).toBe(0);
    expect(estimateEdgeLabelWidth('abcd')).toBeLessThan(estimateEdgeLabelWidth('abcdefgh'));
  });

  it('stops growing where the label is cut', () => {
    expect(estimateEdgeLabelWidth('x'.repeat(EDGE_LABEL_MAX_CHARS))).toBe(
      estimateEdgeLabelWidth('x'.repeat(EDGE_LABEL_MAX_CHARS + 30)),
    );
  });
});

describe('placeEdgeLabels', () => {
  it('puts a label in the middle of its line when nothing is in the way', () => {
    const placed = placeEdgeLabels([segment('e', 'Friend', 0, 0, 200, 100)], []);

    expect(placed.get('e')).toEqual({ x: 100, y: 50 });
  });

  it('moves a label along its line off a node that covers the middle', () => {
    const node = { x: 80, y: 30, width: 40, height: 40 };
    const placed = placeEdgeLabels([segment('e', 'Friend', 0, 50, 200, 50)], [node]);
    const point = placed.get('e')!;
    const plate = edgeLabelRect(point, 'Friend');

    expect(point.y).toBe(50);
    expect(point.x).not.toBe(100);
    expect(plate.x + plate.width <= node.x || plate.x >= node.x + node.width).toBe(true);
  });

  it('keeps the labels of two lines that cross from landing on one another', () => {
    const placed = placeEdgeLabels(
      [segment('a', 'Accuser', 0, 0, 200, 200), segment('b', 'Uninvited guest', 200, 0, 0, 200)],
      [],
    );
    const a = edgeLabelRect(placed.get('a')!, 'Accuser');
    const b = edgeLabelRect(placed.get('b')!, 'Uninvited guest');

    const touching =
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(touching).toBe(false);
  });

  it('keeps the middle for a label with nowhere better to go', () => {
    const wall = { x: -1000, y: -1000, width: 3000, height: 3000 };
    const placed = placeEdgeLabels([segment('e', 'Friend', 0, 0, 200, 0)], [wall]);

    expect(placed.get('e')).toEqual({ x: 100, y: 0 });
  });

  it('is the same for the same segments', () => {
    const segments = [segment('a', 'One', 0, 0, 100, 100), segment('b', 'Two', 100, 0, 0, 100)];

    expect(placeEdgeLabels(segments, [])).toEqual(placeEdgeLabels(segments, []));
  });
});

describe('labelFitsBetween', () => {
  const left = { x: 0, y: 0, width: 100, height: 40 };

  it('is true when the plate in the middle of the line clears both boxes', () => {
    const right = { x: 300, y: 0, width: 100, height: 40 };

    expect(labelFitsBetween(segment('e', 'Friend', 100, 20, 300, 20), left, right)).toBe(true);
  });

  it('is false when the boxes are so close the plate would sit under one', () => {
    const right = { x: 112, y: 0, width: 100, height: 40 };

    expect(
      labelFitsBetween(segment('e', 'Followed him because', 100, 20, 112, 20), left, right),
    ).toBe(false);
  });

  it('is true for a line with no label', () => {
    const right = { x: 112, y: 0, width: 100, height: 40 };

    expect(labelFitsBetween(segment('e', '', 100, 20, 112, 20), left, right)).toBe(true);
  });
});
