/**
 * @jest-environment node
 */
import {
  CANVAS_BOUNDS_GROWTH_STEP,
  growCanvasBounds,
  type CanvasWorldBounds,
} from '../../src/utils/growingCanvasBounds';

const initial: CanvasWorldBounds = { width: 720, height: 720, originX: 0, originY: 0 };

it('allocates a whole page when the world first crosses the upper-left edge', () => {
  const grown = growCanvasBounds(initial, {
    width: 961,
    height: 961,
    originX: -241,
    originY: -241,
  });

  expect(grown).toEqual({
    originX: -CANVAS_BOUNDS_GROWTH_STEP,
    originY: -CANVAS_BOUNDS_GROWTH_STEP,
    width: 720 + CANVAS_BOUNDS_GROWTH_STEP,
    height: 720 + CANVAS_BOUNDS_GROWTH_STEP,
  });
});

it('does not resize while an item moves within the already allocated edge page', () => {
  const allocated = growCanvasBounds(initial, {
    width: 961,
    height: 961,
    originX: -241,
    originY: -241,
  });

  const stable = growCanvasBounds(allocated, {
    width: 962,
    height: 962,
    originX: -242,
    originY: -242,
  });

  expect(stable).toBe(allocated);
});

it('grows the lower-right edge in pages and never shrinks during a gesture', () => {
  const expanded = growCanvasBounds(initial, {
    width: 900,
    height: 730,
    originX: 0,
    originY: 0,
  });
  const returnedInside = growCanvasBounds(expanded, initial);

  expect(expanded).toEqual({
    originX: 0,
    originY: 0,
    width: 720 + CANVAS_BOUNDS_GROWTH_STEP,
    height: 720 + CANVAS_BOUNDS_GROWTH_STEP,
  });
  expect(returnedInside).toBe(expanded);
});
