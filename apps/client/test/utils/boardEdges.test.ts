/**
 * @jest-environment node
 */
import { boardEdgeGeometry, nodeBorderPoint } from '../../src/utils/boardEdges';
import { BOARD_NODE_HEIGHT, BOARD_NODE_WIDTH } from '../../src/utils/boardLayout';

const pin = (id: string, x: number, y: number) => ({
  id,
  kind: 'note' as const,
  x,
  y,
  title: id,
  body: null,
});

it('meets the node on its rectangle, not at the centre', () => {
  const from = pin('01ABCDEF', 0, 0);
  const to = pin('01HJKMNP', 300, 0);
  const centre = { x: to.x + BOARD_NODE_WIDTH / 2, y: to.y + BOARD_NODE_HEIGHT / 2 };
  const border = nodeBorderPoint(to, from.x + BOARD_NODE_WIDTH / 2, from.y + BOARD_NODE_HEIGHT / 2);

  expect(border.x).toBe(to.x);
  expect(border.y).toBeCloseTo(centre.y);
  expect(border.x).not.toBe(centre.x);
});

it('puts a directed arrow at the target border', () => {
  const from = pin('01ABCDEF', 0, 0);
  const to = pin('01HJKMNP', 400, 0);
  const geometry = boardEdgeGeometry(from, to, {
    id: '01QRSTVW',
    from: from.id,
    to: to.id,
    directed: true,
    label: null,
  });

  expect(geometry.arrow.x).toBeGreaterThan(to.x - 4);
  expect(geometry.arrow.x).toBeLessThan(to.x + 1);
});
