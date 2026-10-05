import { describe, expect, it } from 'vitest';
import {
  canvasOverlayPresetPoints,
  simplifyStrokePoints,
} from '../../graphs/canvasOverlayGeometry';
import {
  validateSketchContent,
  CreateSketchDataSchema,
  EMPTY_SKETCH_PAGE,
  generateSketchLocalId,
  remapSketchContent,
  remapSketchCoverGalleryId,
  SketchContentSchema,
} from '../../schemas/SketchSchemas';
import {
  CanvasOverlaySchema,
  canvasOverlayBounds,
} from '../../schemas/CanvasOverlaySchemas';

const overlayId = '01ABCDEF';
const layerId = '02GHJKMN';

function contentWith(overlays: unknown[], layers: unknown[] = []) {
  return validateSketchContent({
    page: { ...EMPTY_SKETCH_PAGE },
    layers,
    overlays,
  });
}

describe('SketchContentSchema', () => {
  it('defaults a new sketch to an A4 page with no layers or overlays', () => {
    expect(CreateSketchDataSchema.parse({ name: 'Throne room' })).toMatchObject({
      name: 'Throne room',
      description: null,
      coverGalleryId: null,
      content: { page: { width: 794, height: 1123 }, layers: [], overlays: [] },
    });
  });

  it('accepts text, freehand lines and stamps', () => {
    const content = contentWith([
      {
        id: overlayId,
        kind: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 10 },
          { x: 60, y: 0 },
        ],
      },
      {
        id: '03PQRSVW',
        kind: 'text',
        x: 10,
        y: 20,
        width: 240,
        content: 'The queen enters',
      },
      { id: '04XYZ123', kind: 'stamp', x: 50, y: 50, icon: 'flag' },
    ]);
    expect(content.overlays).toHaveLength(3);
  });

  it('rejects overlays pointing at a missing layer', () => {
    expect(() =>
      contentWith(
        [{ id: overlayId, kind: 'stamp', x: 1, y: 1, icon: 'flag', layerId }],
        [],
      ),
    ).toThrow(/layer that is not on this sketch/);
  });

  it('accepts overlays on a declared layer and rejects duplicate layer ids', () => {
    const layers = [{ id: layerId, name: 'Ink', visible: true, opacity: 1 }];
    const content = contentWith(
      [{ id: overlayId, kind: 'stamp', x: 1, y: 1, icon: 'flag', layerId }],
      layers,
    );
    expect(content.overlays).toHaveLength(1);
    expect(() =>
      contentWith([], [
        ...layers,
        { id: layerId, name: 'Second', visible: true, opacity: 1 },
      ]),
    ).toThrow(/Duplicate layer id/);
  });

  it('rejects duplicate overlay ids', () => {
    expect(() =>
      contentWith([
        { id: overlayId, kind: 'stamp', x: 1, y: 1, icon: 'flag' },
        { id: overlayId, kind: 'stamp', x: 2, y: 2, icon: 'flag' },
      ]),
    ).toThrow(/Duplicate overlay id/);
  });

  it('rejects pages outside the supported range', () => {
    expect(() =>
      validateSketchContent({ page: { width: 10, height: 10 }, layers: [], overlays: [] }),
    ).toThrow();
  });

  it('allocates unique local ids', () => {
    const first = generateSketchLocalId(new Set());
    expect(generateSketchLocalId(new Set([first]))).not.toBe(first);
    expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('remaps the cover gallery on clone and keeps local ids', () => {
    const content = SketchContentSchema.parse({
      page: { ...EMPTY_SKETCH_PAGE },
      layers: [{ id: layerId, name: 'Ink', visible: true, opacity: 1 }],
      overlays: [{ id: overlayId, kind: 'stamp', x: 1, y: 1, icon: 'flag', layerId }],
    });
    expect(remapSketchContent(content)).toEqual(content);
    expect(remapSketchCoverGalleryId('gallery-1', (id) => (id === 'gallery-1' ? 'gallery-2' : undefined))).toBe(
      'gallery-2',
    );
    expect(remapSketchCoverGalleryId('gallery-9', () => undefined)).toBeNull();
    expect(remapSketchCoverGalleryId(null, () => undefined)).toBeNull();
  });
});

describe('sketch overlay primitives', () => {
  it('builds speech balloons with the tail tip last', () => {
    for (const preset of ['speech-oval', 'speech-rect'] as const) {
      const points = canvasOverlayPresetPoints(preset, { x: 0, y: 0, width: 200, height: 120 });
      expect(points.length).toBeGreaterThan(4);
      const tip = points[points.length - 1];
      // The tip leaves the dragged region downward-right, toward the speaker.
      expect(tip.y).toBeGreaterThan(120);
      expect(tip.x).toBeGreaterThan(100);
      const parsed = CanvasOverlaySchema.parse({
        id: overlayId,
        kind: 'polygon',
        points,
      });
      expect(parsed.kind).toBe('polygon');
    }
  });

  it('simplifies a freehand drag while keeping its endpoints', () => {
    const wobble = Array.from({ length: 120 }, (_, index) => ({
      x: index,
      y: Math.sin(index / 4) * 2,
    }));
    const simplified = simplifyStrokePoints(wobble);
    expect(simplified.length).toBeLessThan(wobble.length);
    expect(simplified[0]).toEqual(wobble[0]);
    expect(simplified[simplified.length - 1]).toEqual(wobble[wobble.length - 1]);
    expect(simplifyStrokePoints([{ x: 0, y: 0 }])).toHaveLength(1);
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
