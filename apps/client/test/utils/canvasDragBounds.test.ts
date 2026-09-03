/**
 * @jest-environment node
 */
import {
  clampCanvasWorldCoordinate,
  limitCanvasDragPosition,
  MAX_CANVAS_WORLD_COORDINATE,
} from '../../src/utils/canvasDragBounds';

const initialBounds = { width: 720, height: 720, originX: 0, originY: 0 };

it('stages a board card at the next right and upper canvas edge instead of jumping pages', () => {
  expect(
    limitCanvasDragPosition(
      { x: 100_000, y: -100_000 },
      initialBounds,
      { left: 0, top: 0, right: 220, bottom: 200 },
      240,
    ),
  ).toEqual({ x: 261, y: -1 });
});

it('uses an existing negative page before asking for the following one', () => {
  expect(
    limitCanvasDragPosition(
      { x: -100_000, y: -100_000 },
      { width: 976, height: 976, originX: -256, originY: -256 },
      { left: 22, top: 22, right: 44, bottom: 44 },
      240,
    ),
  ).toEqual({ x: 5, y: 5 });
});

it('only exposes the next location-map page for an image drag', () => {
  expect(
    limitCanvasDragPosition(
      { x: 100_000, y: 100_000 },
      initialBounds,
      { left: 0, top: 0, right: 320, bottom: 240 },
      240,
    ),
  ).toEqual({ x: 161, y: 241 });
});

it('rejects non-finite and impractically large persisted coordinates', () => {
  expect(clampCanvasWorldCoordinate(Number.NaN)).toBe(0);
  expect(clampCanvasWorldCoordinate(100_000)).toBe(MAX_CANVAS_WORLD_COORDINATE);
  expect(clampCanvasWorldCoordinate(-100_000)).toBe(-MAX_CANVAS_WORLD_COORDINATE);
});
