import { describe, expect, it } from 'vitest';
import {
  clipSpatialSegment,
  isSpatialEnvelopeSafe,
  MAX_SPATIAL_DOCUMENT_SPAN,
  MAX_SPATIAL_NATIVE_SURFACE,
  MAX_SPATIAL_WORLD_COORDINATE,
  spatialBounds,
  spatialNativeSurface,
  spatialRectIntersects,
  spatialRenderWindow,
  spatialScreenToWorld,
  spatialWorldToScreen,
} from '../../graphs/spatialCanvas';

describe('spatial canvas geometry', () => {
  const window = { x: 0, y: 0, width: 100, height: 100 };

  it('finds the complete world bounds without using a render surface', () => {
    expect(
      spatialBounds([
        { x: -20, y: 10, width: 30, height: 10 },
        { x: 90, y: -30, width: 20, height: 80 },
      ]),
    ).toEqual({ x: -20, y: -30, width: 130, height: 80 });
  });

  it('selects only rectangles intersecting the render window', () => {
    expect(spatialRectIntersects({ x: 90, y: 90, width: 20, height: 20 }, window)).toBe(true);
    expect(spatialRectIntersects({ x: 100, y: 90, width: 20, height: 20 }, window)).toBe(false);
  });

  it('clips a connection whose second endpoint is virtualized out', () => {
    expect(clipSpatialSegment({ x: 20, y: 50 }, { x: 180, y: 50 }, window)).toEqual({
      from: { x: 20, y: 50 },
      to: { x: 100, y: 50 },
    });
  });

  it('keeps the passing portion of a connection whose endpoints are both outside', () => {
    expect(clipSpatialSegment({ x: -20, y: 50 }, { x: 120, y: 50 }, window)).toEqual({
      from: { x: 0, y: 50 },
      to: { x: 100, y: 50 },
    });
  });

  it('removes a connection that never reaches the render window', () => {
    expect(clipSpatialSegment({ x: -30, y: -10 }, { x: -2, y: -10 }, window)).toBeNull();
  });

  it('inverts world and screen projection across zoom and a negative origin', () => {
    const origin = { x: -400, y: 120 };
    const pan = { x: 18, y: -9 };
    const scale = 0.4;
    const world = { x: 250, y: -80 };
    const screen = spatialWorldToScreen(world, origin, scale, pan);
    const roundTrip = spatialScreenToWorld(screen, origin, scale, pan);
    expect(roundTrip.x).toBeCloseTo(world.x);
    expect(roundTrip.y).toBeCloseTo(world.y);
  });

  it('sizes the native surface from the viewport, not the document', () => {
    expect(spatialNativeSurface(400, 300)).toEqual({
      width: 1200,
      height: 900,
      overscanX: 400,
      overscanY: 300,
    });
    expect(spatialNativeSurface(3000, 2000).width).toBeLessThanOrEqual(MAX_SPATIAL_NATIVE_SURFACE);
    expect(spatialNativeSurface(3000, 2000).height).toBeLessThanOrEqual(MAX_SPATIAL_NATIVE_SURFACE);
  });

  it('expresses the render window in world units of the local pixel plane', () => {
    expect(spatialRenderWindow({ x: 10, y: 20 }, 300, 150, 0.5)).toEqual({
      x: 10,
      y: 20,
      width: 600,
      height: 300,
    });
  });
});

describe('spatial canvas data envelope', () => {
  it('accepts a large but safe world without tying it to a native surface size', () => {
    expect(
      isSpatialEnvelopeSafe([
        { x: -MAX_SPATIAL_WORLD_COORDINATE, y: -20, width: 20, height: 20 },
        { x: MAX_SPATIAL_WORLD_COORDINATE - 20, y: 20, width: 20, height: 20 },
      ]),
    ).toBe(true);
  });

  it('rejects geometry outside the coordinate or span envelope', () => {
    expect(
      isSpatialEnvelopeSafe([{ x: MAX_SPATIAL_WORLD_COORDINATE, y: 0, width: 1, height: 1 }]),
    ).toBe(false);
    expect(
      isSpatialEnvelopeSafe([{ x: 0, y: 0, width: MAX_SPATIAL_DOCUMENT_SPAN + 1, height: 1 }]),
    ).toBe(false);
  });
});
