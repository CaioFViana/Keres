import { describe, expect, it } from 'vitest';
import { CanvasOverlaySchema, canvasOverlayBounds } from '../../schemas/CanvasOverlaySchemas';
import {
  CreateSketchDataSchema,
  EMPTY_SKETCH_PAGE,
  emptySketchContent,
  generateSketchLocalId,
  remapSketchContent,
  remapSketchCoverGalleryId,
  SketchContentSchema,
  validateSketchContent,
} from '../../schemas/SketchSchemas';
import { encodeSketchItems } from '../../sketch/sketchCodec';
import { MAX_SKETCH_TOTAL_DATA_LENGTH, type SketchItem } from '../../sketch/sketchTypes';

const overlayId = '01ABCDEF';
const layerId = '02GHJKMN';
const otherLayerId = '03PQRSVW';

function layer(id: string, data = '') {
  return { id, name: 'Ink', visible: true, opacity: 1, locked: false, data };
}

function contentWith(overlays: unknown[], layers: unknown[] = [layer(layerId)]) {
  return validateSketchContent({ page: { ...EMPTY_SKETCH_PAGE }, layers, overlays });
}

const oneStroke: SketchItem[] = [
  {
    kind: 'stroke',
    brush: 'pen',
    color: '#000000',
    alpha: 1,
    size: 3,
    points: [0, 0, 40, 20, 80, 0],
  },
];

describe('SketchContentSchema', () => {
  it('builds a blank sketch with one empty layer on an A4 page', () => {
    const content = emptySketchContent(layerId, 'Layer 1');
    expect(validateSketchContent(content)).toEqual(content);
    expect(content.page).toMatchObject({ width: 794, height: 1123, background: 'paper' });
    expect(content.layers).toHaveLength(1);
    expect(content.layers[0].data).toBe('');
  });

  it('requires content when creating and at least one layer', () => {
    expect(() => CreateSketchDataSchema.parse({ name: 'Throne room' })).toThrow();
    expect(() =>
      validateSketchContent({ page: { ...EMPTY_SKETCH_PAGE }, layers: [], overlays: [] }),
    ).toThrow();
    expect(
      CreateSketchDataSchema.parse({
        name: 'Throne room',
        content: emptySketchContent(layerId, 'Layer 1'),
      }),
    ).toMatchObject({ name: 'Throne room', description: null, coverGalleryId: null });
  });

  it('accepts encoded layer data, text, balloons and stamps', () => {
    const content = contentWith(
      [
        {
          id: '03PQRSVW',
          kind: 'text',
          x: 10,
          y: 20,
          width: 240,
          content: 'The queen enters',
        },
        { id: '04XYZ123', kind: 'stamp', x: 50, y: 50, icon: 'flag' },
      ],
      [layer(layerId, encodeSketchItems(oneStroke))],
    );
    expect(content.overlays).toHaveLength(2);
  });

  it('rejects layer data that does not decode', () => {
    expect(() => contentWith([], [layer(layerId, 'AAAA')])).toThrow(
      /Invalid layer data|Unsupported|corrupt|Unexpected/,
    );
    expect(() => contentWith([], [layer(layerId, '!!!')])).toThrow();
  });

  it('rejects a sketch whose layers exceed the total size budget', () => {
    const big = 'A'.repeat(Math.floor(MAX_SKETCH_TOTAL_DATA_LENGTH / 2) + 4);
    // Each chunk is within the per-layer cap; together they are over budget.
    expect(() => contentWith([], [layer(layerId, big), layer(otherLayerId, big)])).toThrow(
      /too large/,
    );
  });

  it('rejects duplicate layer ids and duplicate overlay ids', () => {
    expect(() => contentWith([], [layer(layerId), layer(layerId)])).toThrow(/Duplicate layer id/);
    expect(() =>
      contentWith([
        { id: overlayId, kind: 'stamp', x: 1, y: 1, icon: 'flag' },
        { id: overlayId, kind: 'stamp', x: 2, y: 2, icon: 'flag' },
      ]),
    ).toThrow(/Duplicate overlay id/);
  });

  it('rejects pages outside the supported range', () => {
    expect(() =>
      validateSketchContent({
        page: { width: 10, height: 10 },
        layers: [layer(layerId)],
        overlays: [],
      }),
    ).toThrow();
  });

  it('allocates unique local ids', () => {
    const first = generateSketchLocalId(new Set());
    expect(generateSketchLocalId(new Set([first]))).not.toBe(first);
    expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('keeps the drawing on clone and remaps only the cover gallery', () => {
    const content = SketchContentSchema.parse({
      page: { ...EMPTY_SKETCH_PAGE },
      layers: [layer(layerId, encodeSketchItems(oneStroke))],
      overlays: [{ id: overlayId, kind: 'stamp', x: 1, y: 1, icon: 'flag' }],
    });
    expect(remapSketchContent(content)).toEqual(content);
    expect(
      remapSketchCoverGalleryId('gallery-1', (id) =>
        id === 'gallery-1' ? 'gallery-2' : undefined,
      ),
    ).toBe('gallery-2');
    expect(remapSketchCoverGalleryId('gallery-9', () => undefined)).toBeNull();
    expect(remapSketchCoverGalleryId(null, () => undefined)).toBeNull();
  });
});

describe('sketch overlay primitives', () => {
  it('accepts a balloon and bounds it by the ellipse and its tail', () => {
    const balloon = CanvasOverlaySchema.parse({
      id: overlayId,
      kind: 'balloon',
      x: 10,
      y: 20,
      width: 200,
      height: 120,
      tail: { x: 260, y: 200 },
      content: 'Who goes there?',
    });
    expect(balloon.kind).toBe('balloon');
    expect(canvasOverlayBounds(balloon)).toEqual({ x: 10, y: 20, width: 250, height: 180 });
    expect(CanvasOverlaySchema.safeParse({ ...balloon, width: 5 }).success).toBe(false);
  });

  it('bounds a text overlay from its wrapped lines', () => {
    const bounds = canvasOverlayBounds(
      CanvasOverlaySchema.parse({
        id: overlayId,
        kind: 'text',
        x: 10,
        y: 20,
        width: 240,
        content: 'one two three',
      }),
    );
    expect(bounds.x).toBe(10);
    expect(bounds.y).toBe(20);
    expect(bounds.width).toBe(240);
    expect(bounds.height).toBeGreaterThan(0);
  });
});
