import { describe, expect, it } from 'vitest';
import {
  locationMapCanvasBounds,
  locationMapCanvasSize,
  LOCATION_MAP_CANVAS_MIN,
  LOCATION_MAP_CANVAS_PADDING,
  LOCATION_MAP_NODE_SIZE,
} from '../../graphs/locationMapLayout';
describe('location map layout', () => {
  it('returns the minimum canvas for an empty map', () =>
    expect(locationMapCanvasSize({ images: [], nodes: [] })).toEqual({
      width: LOCATION_MAP_CANVAS_MIN,
      height: LOCATION_MAP_CANVAS_MIN,
    }));
  it('extends the plane above and left for a negative point', () => {
    const bounds = locationMapCanvasBounds({
      images: [],
      nodes: [{ id: 'negative', locationId: 'l1', x: -50, y: -30, icon: 'pin', color: '#8BC34A' }],
    });
    expect(bounds.originX).toBe(-50 - LOCATION_MAP_NODE_SIZE / 2 - LOCATION_MAP_CANVAS_PADDING);
    expect(bounds.originY).toBe(-30 - LOCATION_MAP_NODE_SIZE / 2 - LOCATION_MAP_CANVAS_PADDING);
  });
});
