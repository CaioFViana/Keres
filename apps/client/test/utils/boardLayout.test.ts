/**
 * @jest-environment node
 */
import {
  boardCanvasSize,
  boardNodeSize,
  normalizeBoardCanvas,
  BOARD_CANVAS_MIN,
  BOARD_CANVAS_PADDING,
  BOARD_NOTE_WIDTH,
  BOARD_NOTE_HEIGHT,
} from '../../src/utils/boardLayout';

it('grows the drawing past the minimum when a pin is near the edge', () => {
  const empty = boardCanvasSize([]);
  expect(empty).toEqual({ width: BOARD_CANVAS_MIN, height: BOARD_CANVAS_MIN });

  const grown = boardCanvasSize([
    {
      id: '01ABCDEF',
      kind: 'note',
      x: 900,
      y: 40,
      title: 'Edge',
      body: null,
    },
  ]);
  expect(grown.width).toBeGreaterThan(BOARD_CANVAS_MIN);
  expect(grown.height).toBe(BOARD_CANVAS_MIN);
});

it('sizes a note card bigger than an entity pin', () => {
  const note = { id: 'n', kind: 'note' as const, x: 0, y: 0, title: 'N', body: null };
  const entity = {
    id: 'e',
    kind: 'entity' as const,
    x: 0,
    y: 0,
    entityType: 'Character' as const,
    entityId: 'c1',
    labelAtPin: 'Frodo',
  };

  expect(boardNodeSize(note)).toEqual({ width: BOARD_NOTE_WIDTH, height: BOARD_NOTE_HEIGHT });
  expect(boardNodeSize(entity).width).toBeLessThan(BOARD_NOTE_WIDTH);
});

describe('normalizeBoardCanvas', () => {
  const note = (id: string, x: number, y: number) => ({
    id,
    kind: 'note' as const,
    x,
    y,
    title: 'Pin',
    body: null,
  });

  it('returns the minimum canvas and no offset for an empty board', () => {
    expect(normalizeBoardCanvas([])).toEqual({
      offsetX: 0,
      offsetY: 0,
      width: BOARD_CANVAS_MIN,
      height: BOARD_CANVAS_MIN,
    });
  });

  it('shifts the top-left corner of the bounds to the padding', () => {
    const normalized = normalizeBoardCanvas([note('a', 40, 40), note('b', 300, 200)]);
    const size = boardNodeSize(note('a', 0, 0));

    expect(normalized.offsetX).toBe(BOARD_CANVAS_PADDING - 40);
    expect(normalized.offsetY).toBe(BOARD_CANVAS_PADDING - 40);
    expect(normalized.width).toBe(
      Math.max(BOARD_CANVAS_MIN, 300 + size.width - 40 + BOARD_CANVAS_PADDING * 2),
    );
    expect(normalized.height).toBe(
      Math.max(BOARD_CANVAS_MIN, 200 + size.height - 40 + BOARD_CANVAS_PADDING * 2),
    );
  });

  it('brings a node dragged to negative coordinates back inside the drawing', () => {
    const normalized = normalizeBoardCanvas([note('a', -300, -200)]);
    const size = boardNodeSize(note('a', 0, 0));

    expect(normalized.offsetX).toBe(BOARD_CANVAS_PADDING + 300);
    expect(normalized.offsetY).toBe(BOARD_CANVAS_PADDING + 200);
    expect(normalized.width).toBe(
      Math.max(BOARD_CANVAS_MIN, size.width + BOARD_CANVAS_PADDING * 2),
    );
    expect(normalized.height).toBe(
      Math.max(BOARD_CANVAS_MIN, size.height + BOARD_CANVAS_PADDING * 2),
    );
  });
});
