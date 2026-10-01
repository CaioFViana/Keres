/**
 * @jest-environment node
 */
import type { CanvasOverlayType } from '@keres/shared';
import {
  canvasOverlayExportBounds,
  renderCanvasOverlaySvg,
} from '../../src/utils/canvasOverlaySvg';

const COLORS = {
  background: '#ffffff',
  surface: '#f2f2f2',
  text: '#111111',
  textSecondary: '#666666',
  border: '#cccccc',
  primary: '#8855ff',
};
const CONTEXT = {
  shift: (x: number, y: number) => ({ x: x + 10, y: y + 20 }),
  colors: COLORS,
  stroke: COLORS.text,
};

function render(overlays: CanvasOverlayType[]) {
  return renderCanvasOverlaySvg(overlays, CONTEXT);
}

it('returns empty groups without overlays', () => {
  expect(renderCanvasOverlaySvg(undefined, CONTEXT)).toEqual({ vectors: [], stamps: [] });
  expect(render([])).toEqual({ vectors: [], stamps: [] });
});

it('draws a line through the shifted points with its own stroke', () => {
  const { vectors, stamps } = render([
    {
      id: 'ov-1',
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      color: '#f00',
    },
  ]);
  expect(stamps).toEqual([]);
  expect(vectors).toHaveLength(1);
  expect(vectors[0]).toContain('<path d="M 10 20 L 110 20"');
  expect(vectors[0]).toContain('stroke="#f00" stroke-width="2"');
  expect(vectors[0]).not.toContain('stroke-dasharray');
});

it('dashes lines and tips directed ones with an arrowhead', () => {
  const { vectors } = render([
    {
      id: 'ov-1',
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      dashed: true,
      directed: true,
      strokeWidth: 3,
    },
  ]);
  expect(vectors[0]).toContain('stroke="#111111" stroke-width="3"');
  expect(vectors[0]).toContain('stroke-dasharray="6 4"');
  // The shared triangle, tip on the last shifted point.
  expect(vectors[0]).toContain('<polygon points="110,20 ');
  expect(vectors[0]).toContain('fill="#111111"');
});

it('falls back to the surface stroke for colorless vectors, keeping stamps primary', () => {
  const mapContext = { ...CONTEXT, stroke: COLORS.primary };
  const { vectors, stamps } = renderCanvasOverlaySvg(
    [
      {
        id: 'ov-1',
        kind: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
      { id: 'ov-2', kind: 'stamp', x: 0, y: 0, icon: 'keres:castle' },
    ] as CanvasOverlayType[],
    mapContext,
  );
  expect(vectors[0]).toContain('stroke="#8855ff"');
  expect(vectors[0]).not.toContain('#111111');
  expect(stamps[0]).toContain('stroke="#8855ff"');
});

it('outlines polygons by default, filling and dashing on request', () => {
  const { vectors } = render([
    {
      id: 'ov-1',
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 50 },
      ],
      color: '#0f0',
    },
    {
      id: 'ov-2',
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 50 },
      ],
      color: '#0f0',
      filled: true,
      dashed: true,
    },
  ]);
  expect(vectors[0]).toContain('<path d="M 10 20 L 110 20 L 60 70 Z"');
  expect(vectors[0]).not.toContain('fill-opacity');
  expect(vectors[0]).not.toContain('stroke-dasharray');
  expect(vectors[1]).toContain('<path d="M 10 20 L 110 20 L 60 70 Z" fill="#0f0"');
  expect(vectors[1]).toContain('fill-opacity="0.18"');
  expect(vectors[1]).toContain('stroke="#0f0" stroke-width="2"');
  expect(vectors[1]).toContain('stroke-dasharray="6 4"');
});

it('dashes frames unless opted out, always at the default width', () => {
  const { vectors } = render([
    { id: 'ov-1', kind: 'frame', x: 0, y: 0, width: 100, height: 60 },
    { id: 'ov-2', kind: 'frame', x: 0, y: 0, width: 100, height: 60, dashed: false },
  ]);
  expect(vectors[0]).toContain('<path d="M 10 20 L 110 20 L 110 80 L 10 80 Z"');
  expect(vectors[0]).toContain('stroke-width="2"');
  expect(vectors[0]).toContain('stroke-dasharray="6 4"');
  expect(vectors[1]).not.toContain('stroke-dasharray');
});

it('draws shapes as rects or ellipses, filled and dashed on request', () => {
  const { vectors } = render([
    { id: 'ov-1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, width: 100, height: 60 },
    {
      id: 'ov-2',
      kind: 'shape',
      shapeType: 'ellipse',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      filled: true,
      dashed: true,
      color: '#00f',
    },
  ]);
  expect(vectors[0]).toContain('<path d="M 10 20 L 110 20 L 110 80 L 10 80 Z"');
  expect(vectors[0]).not.toContain('fill-opacity');
  expect(vectors[0]).not.toContain('stroke-dasharray');
  expect(vectors[1]).toContain(' A ');
  expect(vectors[1]).toContain('fill="#00f" fill-opacity="0.25"');
  expect(vectors[1]).toContain('stroke-dasharray="6 4"');
});

it('fills frames on request, still dashed unless opted out', () => {
  const { vectors } = render([
    { id: 'ov-1', kind: 'frame', x: 0, y: 0, width: 100, height: 60, filled: true },
  ]);
  expect(vectors[0]).toContain('fill-opacity="0.25"');
  expect(vectors[0]).toContain('stroke-dasharray="6 4"');
});

it('centers escaped labels on the shape with a halo', () => {
  const { vectors } = render([
    {
      id: 'ov-1',
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      label: 'A & <B>',
    },
  ]);
  expect(vectors[0]).toContain('A &amp; &lt;B&gt;');
  expect(vectors[0]).not.toContain('A & <B>');
  // Bounds center (50,0), shifted to (60,20).
  expect(vectors[0]).toContain('<text x="60" y="20" font-size="11" text-anchor="middle"');
  expect(vectors[0]).toContain('stroke="#ffffff" stroke-width="4"');
});

it('paints lower zIndex first, document order breaking ties', () => {
  const line = (id: string, color: string, zIndex?: number): CanvasOverlayType => ({
    id,
    kind: 'line',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    color,
    ...(zIndex === undefined ? {} : { zIndex }),
  });
  const { vectors } = render([
    line('a', '#aaaaaa', 1),
    line('b', '#bbbbbb'),
    line('c', '#cccccc', 1),
  ]);
  expect(vectors.join('').indexOf('#bbbbbb')).toBeLessThan(vectors.join('').indexOf('#aaaaaa'));
  expect(vectors.join('').indexOf('#aaaaaa')).toBeLessThan(vectors.join('').indexOf('#cccccc'));
});

it('draws a stamp as a circle with its icon and a label below', () => {
  const { vectors, stamps } = render([
    { id: 'ov-1', kind: 'stamp', x: 100, y: 100, icon: 'pin', label: 'Keep' },
  ]);
  expect(vectors).toEqual([]);
  expect(stamps).toHaveLength(1);
  // Center (110,120), radius 18, primary border like the screen default.
  expect(stamps[0]).toContain('<circle cx="110" cy="120" r="18"');
  expect(stamps[0]).toContain('stroke="#8855ff" stroke-width="1.5"');
  // The icon shapes carry the same color and a transform.
  expect(stamps[0]).toContain('fill="#8855ff" transform="translate(');
  // Label below the circle, sharing the node label size.
  expect(stamps[0]).toContain('<text x="110" y="152" font-size="10"');
  expect(stamps[0]).toContain('>Keep</text>');
});

it('renders stamps without a matching icon as a circle only', () => {
  const { stamps } = render([
    { id: 'ov-1', kind: 'stamp', x: 0, y: 0, icon: 'fa:castle', color: '#123456' },
  ]);
  expect(stamps[0]).toContain('<circle ');
  expect(stamps[0]).not.toContain('<path');
  expect(stamps[0]).not.toContain('<text');
});

it('reserves label room below labelled stamps only', () => {
  expect(
    canvasOverlayExportBounds({ id: 'ov-1', kind: 'stamp', x: 100, y: 100, icon: 'pin' }),
  ).toEqual({ x: 82, y: 82, width: 36, height: 36 });
  expect(
    canvasOverlayExportBounds({
      id: 'ov-1',
      kind: 'stamp',
      x: 100,
      y: 100,
      icon: 'pin',
      label: 'Keep',
    }),
  ).toEqual({ x: 82, y: 82, width: 36, height: 54 });
  expect(
    canvasOverlayExportBounds({
      id: 'ov-1',
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
    }),
  ).toEqual({ x: 0, y: 0, width: 100, height: 50 });
});
