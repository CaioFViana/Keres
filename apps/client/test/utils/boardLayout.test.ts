/**
 * @jest-environment node
 */
import {
  boardCanvasSize,
  boardNodeSize,
  noteSizeFor,
  normalizeBoardCanvas,
  wrapNoteBody,
  BOARD_CANVAS_MIN,
  BOARD_CANVAS_PADDING,
  BOARD_GALLERY_HEIGHT,
  BOARD_GALLERY_WIDTH,
  BOARD_NODE_HEIGHT,
  BOARD_NODE_WIDTH,
  BOARD_NOTE_HEIGHT,
  BOARD_NOTE_WIDTH,
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

it('sizes entity pins at the standard size', () => {
  const entity = {
    id: 'e',
    kind: 'entity' as const,
    x: 0,
    y: 0,
    entityType: 'Character' as const,
    entityId: 'c1',
    labelAtPin: 'Frodo',
  };

  expect(boardNodeSize(entity)).toEqual({ width: BOARD_NODE_WIDTH, height: BOARD_NODE_HEIGHT });
});

it('grows a Gallery pin with an image into a bigger card', () => {
  const gallery = {
    id: 'g',
    kind: 'entity' as const,
    x: 0,
    y: 0,
    entityType: 'Gallery' as const,
    entityId: 'gal-1',
    labelAtPin: 'Capa',
  };
  const withImage = { mediaType: 'image', mimeType: 'image/png', localPath: 'file:///a.png', thumbnailPath: null };
  const withoutImage = { mediaType: 'document', mimeType: 'application/pdf', localPath: null, thumbnailPath: null };

  expect(boardNodeSize(gallery, withImage)).toEqual({
    width: BOARD_GALLERY_WIDTH,
    height: BOARD_GALLERY_HEIGHT,
  });
  expect(boardNodeSize(gallery, withoutImage)).toEqual({
    width: BOARD_NODE_WIDTH,
    height: BOARD_NODE_HEIGHT,
  });
  expect(boardNodeSize(gallery)).toEqual({ width: BOARD_NODE_WIDTH, height: BOARD_NODE_HEIGHT });
});

it('keeps a note with no body at the standard pin size', () => {
  const note = { id: 'n', kind: 'note' as const, x: 0, y: 0, title: 'Título', body: null };

  expect(boardNodeSize(note)).toEqual({ width: BOARD_NODE_WIDTH, height: BOARD_NODE_HEIGHT });
});

it('grows a note with its body text up to the note maximum', () => {
  const short = noteSizeFor('Título', 'Uma linha curta.');
  const long = noteSizeFor(
    'Título',
    Array.from({ length: 12 }, () => 'palavra '.repeat(6).trim()).join('\n'),
  );

  expect(short.width).toBeGreaterThanOrEqual(BOARD_NODE_WIDTH);
  expect(short.width).toBeLessThanOrEqual(BOARD_NOTE_WIDTH);
  expect(short.height).toBeGreaterThanOrEqual(BOARD_NODE_HEIGHT);
  expect(short.height).toBeLessThanOrEqual(BOARD_NOTE_HEIGHT);
  expect(long.width).toBe(BOARD_NOTE_WIDTH);
  expect(long.height).toBe(BOARD_NOTE_HEIGHT);
  expect(long.height).toBeGreaterThan(short.height);
});

it('wraps a note body into capped lines', () => {
  const lines = wrapNoteBody('uma palavra longa '.repeat(20).trim(), 10, 31);

  expect(lines.length).toBe(10);
  expect(lines[lines.length - 1].endsWith('…')).toBe(true);
  expect(wrapNoteBody('primeira\nsegunda', 10, 31)).toEqual(['primeira', 'segunda']);
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
