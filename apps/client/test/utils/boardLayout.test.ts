/**
 * @jest-environment node
 */
import { boardCanvasSize, BOARD_CANVAS_MIN } from '../../src/utils/boardLayout';

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
