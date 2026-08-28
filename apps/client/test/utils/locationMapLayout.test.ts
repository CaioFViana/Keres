/**
 * @jest-environment node
 */
import {
  locationMapCanvasSize,
  LOCATION_MAP_CANVAS_MIN,
  LOCATION_MAP_CANVAS_PADDING,
  LOCATION_MAP_NODE_SIZE,
} from '../../src/utils/locationMapLayout';

it('returns the minimum canvas for an empty map', () => {
  expect(locationMapCanvasSize({ images: [], nodes: [] })).toEqual({
    width: LOCATION_MAP_CANVAS_MIN,
    height: LOCATION_MAP_CANVAS_MIN,
  });
});

it('grows the canvas with image bases and location points', () => {
  const size = locationMapCanvasSize({
    images: [{ id: '01ABCDEF', galleryId: 'g1', x: 0, y: 0, width: 400, height: 300 }],
    nodes: [{ id: '02GHJKMN', locationId: 'l1', x: 600, y: 500, icon: 'pin', color: '#8BC34A' }],
  });

  expect(size.width).toBe(
    Math.max(LOCATION_MAP_CANVAS_MIN, 600 + LOCATION_MAP_NODE_SIZE + LOCATION_MAP_CANVAS_PADDING),
  );
  expect(size.height).toBe(
    Math.max(LOCATION_MAP_CANVAS_MIN, 500 + LOCATION_MAP_NODE_SIZE + LOCATION_MAP_CANVAS_PADDING),
  );
});