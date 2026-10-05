/**
 * @jest-environment node
 */
import {
  addLayer,
  appendStroke,
  decodeSketchDocument,
  emptySketchContent,
  insertFill,
  patchLayer,
  type SketchDocument,
  type SketchStroke,
} from '@keres/shared';
import { renderSketchSvg } from '../../src/utils/sketchSvg';

const COLORS = {
  background: '#ffffff',
  surface: '#f2f2f2',
  text: '#111111',
  textSecondary: '#666666',
  border: '#cccccc',
  primary: '#8855ff',
};
const OPTIONS = { title: 'Throne room', colors: COLORS, paper: '#f2f2f2' };

function blank(): SketchDocument {
  return decodeSketchDocument(
    emptySketchContent('AAAAAAAA', 'Layer 1', { width: 400, height: 300, preset: null }),
  );
}

const stroke = (alpha = 1): SketchStroke => ({
  kind: 'stroke',
  brush: 'pen',
  color: '#112233',
  alpha,
  size: 4,
  points: [0, 0, 100, 50, 200, 0],
});

it('draws the paper, then strokes as round-capped paths', () => {
  const svg = renderSketchSvg(appendStroke(blank(), 'AAAAAAAA', stroke()), OPTIONS);
  expect(svg).toContain('width="400" height="300"');
  expect(svg).toContain('<rect x="0" y="0" width="400" height="300" fill="#f2f2f2"/>');
  expect(svg).toContain('stroke="#112233"');
  expect(svg).toContain('stroke-linecap="round"');
  expect(svg).toContain('fill="none"');
  expect(svg).not.toContain('stroke-opacity');
});

it('carries stroke opacity, butt caps for the highlighter, and even-odd fills', () => {
  let doc = appendStroke(blank(), 'AAAAAAAA', { ...stroke(0.35), brush: 'highlighter' });
  doc = insertFill(doc, 'AAAAAAAA', {
    kind: 'fill',
    color: '#ff0000',
    alpha: 1,
    rings: [[0, 0, 50, 0, 50, 50, 0, 50]],
  });
  const svg = renderSketchSvg(doc, OPTIONS);
  expect(svg).toContain('stroke-opacity="0.35"');
  expect(svg).toContain('stroke-linecap="butt"');
  expect(svg).toContain('fill="#ff0000"');
  expect(svg).toContain('fill-rule="evenodd"');
});

it('paints fills below strokes (document order within the layer)', () => {
  let doc = appendStroke(blank(), 'AAAAAAAA', stroke());
  doc = insertFill(doc, 'AAAAAAAA', {
    kind: 'fill',
    color: '#ff0000',
    alpha: 1,
    rings: [[0, 0, 9, 0, 9, 9]],
  });
  const svg = renderSketchSvg(doc, OPTIONS);
  expect(svg.indexOf('fill-rule="evenodd"')).toBeLessThan(svg.indexOf('stroke-linecap'));
});

it('skips hidden and empty layers and wraps translucent ones', () => {
  let doc = appendStroke(blank(), 'AAAAAAAA', stroke());
  doc = addLayer(doc, 'Hidden');
  const hiddenId = doc.layers[1].id;
  doc = appendStroke(doc, hiddenId, { ...stroke(), color: '#aa0000' });
  doc = patchLayer(doc, hiddenId, { visible: false });
  doc = addLayer(doc, 'Faint');
  const faintId = doc.layers[2].id;
  doc = appendStroke(doc, faintId, { ...stroke(), color: '#00aa00' });
  doc = patchLayer(doc, faintId, { opacity: 0.5 });
  doc = addLayer(doc, 'Empty');
  const svg = renderSketchSvg(doc, OPTIONS);
  expect(svg).not.toContain('#aa0000');
  expect(svg).toContain('<g opacity="0.5">');
  expect(svg).toContain('#00aa00');
  expect(svg.match(/<g/g)).toHaveLength(2);
});

it('omits the paper for a transparent page and uses white for a white one', () => {
  const transparent = { ...blank(), page: { ...blank().page, background: 'transparent' as const } };
  expect(renderSketchSvg(transparent, OPTIONS)).not.toContain('<rect x="0" y="0" width="400"');
  const white = { ...blank(), page: { ...blank().page, background: 'white' as const } };
  expect(renderSketchSvg(white, OPTIONS)).toContain('fill="#ffffff"/>');
});

it('keeps objects above the drawing', () => {
  const doc = {
    ...appendStroke(blank(), 'AAAAAAAA', stroke()),
    overlays: [
      { id: '01ABCDEF', kind: 'text' as const, x: 10, y: 20, width: 200, content: 'Hello' },
    ],
  };
  const svg = renderSketchSvg(doc, OPTIONS);
  expect(svg.indexOf('stroke-linecap')).toBeLessThan(svg.indexOf('Hello'));
});
