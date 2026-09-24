import { describe, expect, it } from 'vitest';
import { BoardContentSchema, remapBoardContent } from '../../schemas/BoardSchemas';
import {
  CANVAS_OVERLAY_STAMP_DEFAULT_SIZE,
  canvasOverlayBounds,
  CanvasOverlaySchema,
  type CanvasOverlayType,
} from '../../schemas/CanvasOverlaySchemas';
import {
  LocationMapContentSchema,
  remapLocationMapContent,
} from '../../schemas/LocationMapSchemas';

const lineId = '03PQRSTV';
const polygonId = '04WXYZ12';
const frameId = '05ABCDHJ';
const shapeId = '06KMPQRT';
const stampId = '07VWXYZ1';
const nodeId = '01ABCDEF';

describe('CanvasOverlaySchema', () => {
  it('accepts one overlay of every kind', () => {
    const overlays = [
      {
        id: lineId,
        kind: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      },
      {
        id: polygonId,
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
      },
      { id: frameId, kind: 'frame', x: 0, y: 0, width: 100, height: 60 },
      { id: shapeId, kind: 'shape', shapeType: 'ellipse', x: 0, y: 0, width: 40, height: 40 },
      { id: stampId, kind: 'stamp', x: 50, y: 50, icon: 'flag' },
    ];
    for (const overlay of overlays) {
      expect(CanvasOverlaySchema.parse(overlay)).toMatchObject({ id: overlay.id });
    }
  });

  it('accepts the lock flag on every kind', () => {
    const overlays = [
      {
        id: lineId,
        kind: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        locked: true,
      },
      {
        id: polygonId,
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
        locked: true,
      },
      { id: frameId, kind: 'frame', x: 0, y: 0, width: 100, height: 60, locked: true },
      {
        id: shapeId,
        kind: 'shape',
        shapeType: 'ellipse',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        locked: true,
      },
      { id: stampId, kind: 'stamp', x: 50, y: 50, icon: 'flag', locked: true },
    ];
    for (const overlay of overlays) {
      expect(CanvasOverlaySchema.parse(overlay)).toMatchObject({ locked: true });
    }
  });

  it('rejects under-defined geometry', () => {
    expect(() =>
      CanvasOverlaySchema.parse({
        id: lineId,
        kind: 'line',
        points: [{ x: 0, y: 0 }],
      }),
    ).toThrow();
    expect(() =>
      CanvasOverlaySchema.parse({
        id: polygonId,
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      }),
    ).toThrow();
    expect(() =>
      CanvasOverlaySchema.parse({
        id: frameId,
        kind: 'frame',
        x: 0,
        y: 0,
        width: -5,
        height: 60,
      }),
    ).toThrow();
  });

  it('rejects non-Crockford ids', () => {
    expect(() =>
      CanvasOverlaySchema.parse({
        id: 'not-an-id',
        kind: 'frame',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      }),
    ).toThrow(/8 Crockford characters/);
  });
});

describe('canvasOverlayBounds', () => {
  it('bounds point lists by their extrema', () => {
    expect(
      canvasOverlayBounds({
        id: lineId,
        kind: 'line',
        points: [
          { x: 4, y: 1 },
          { x: 10, y: 7 },
        ],
      }),
    ).toEqual({ x: 4, y: 1, width: 6, height: 6 });
  });

  it('bounds rects directly and centers stamps', () => {
    expect(
      canvasOverlayBounds({ id: frameId, kind: 'frame', x: 2, y: 3, width: 10, height: 20 }),
    ).toEqual({ x: 2, y: 3, width: 10, height: 20 });
    const half = CANVAS_OVERLAY_STAMP_DEFAULT_SIZE / 2;
    expect(canvasOverlayBounds({ id: stampId, kind: 'stamp', x: 50, y: 50, icon: 'flag' })).toEqual(
      {
        x: 50 - half,
        y: 50 - half,
        width: CANVAS_OVERLAY_STAMP_DEFAULT_SIZE,
        height: CANVAS_OVERLAY_STAMP_DEFAULT_SIZE,
      },
    );
  });
});

describe('overlays inside canvas documents', () => {
  it('keeps drawings without overlays valid', () => {
    expect(BoardContentSchema.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] });
    expect(LocationMapContentSchema.parse({ images: [], nodes: [] })).toEqual({
      images: [],
      nodes: [],
    });
  });

  it('rejects duplicate overlay ids and collisions with nodes', () => {
    const overlay: CanvasOverlayType = {
      id: lineId,
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    };
    expect(() =>
      BoardContentSchema.parse({ nodes: [], edges: [], overlays: [overlay, { ...overlay }] }),
    ).toThrow(/Duplicate overlay id/);
    expect(() =>
      BoardContentSchema.parse({
        nodes: [{ id: nodeId, kind: 'note', x: 0, y: 0, title: 'N', body: null }],
        edges: [],
        overlays: [{ ...overlay, id: nodeId }],
      }),
    ).toThrow(/Duplicate overlay id/);
    expect(() =>
      LocationMapContentSchema.parse({
        images: [],
        nodes: [{ id: nodeId, locationId: 'loc-1', x: 0, y: 0, icon: 'pin' }],
        overlays: [{ ...overlay, id: nodeId }],
      }),
    ).toThrow(/Duplicate overlay id/);
  });

  it('rejects an overlay outside the spatial envelope', () => {
    expect(() =>
      LocationMapContentSchema.parse({
        images: [],
        nodes: [],
        overlays: [{ id: frameId, kind: 'frame', x: 100_000, y: 0, width: 10, height: 10 }],
      }),
    ).toThrow(/spatial canvas envelope/);
  });

  it('remaps preserve overlays untouched', () => {
    const overlay: CanvasOverlayType = {
      id: lineId,
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    };
    const board = remapBoardContent({ nodes: [], edges: [], overlays: [overlay] }, (id) => id);
    expect(board.overlays).toEqual([overlay]);
    const map = remapLocationMapContent({ images: [], nodes: [], overlays: [overlay] }, (id) => id);
    expect(map.overlays).toEqual([overlay]);
  });
});
