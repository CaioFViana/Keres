/**
 * @jest-environment node
 */
import { renderBoardSvg } from '../../src/utils/boardSvg';
import { BOARD_CANVAS_PADDING } from '../../src/utils/boardLayout';

const content = {
  nodes: [
    {
      id: '01ABCDEF',
      kind: 'note' as const,
      x: 40,
      y: 40,
      title: 'Tolkien & <Cia>',
      body: null,
    },
  ],
  edges: [],
};

const options = {
  title: 'Royal family',
  subtitle: 'A Queda · 1 pins',
  colors: {
    background: '#ffffff',
    surface: '#f2f2f2',
    text: '#111111',
    textSecondary: '#666666',
    border: '#cccccc',
  },
  titles: {
    '01ABCDEF': { title: 'Tolkien & <Cia>', typeLabel: 'Note' },
  },
};

it('emits a standalone SVG and escapes the pin title', () => {
  const svg = renderBoardSvg(content, options);

  expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(svg).toContain('Tolkien &amp; &lt;Cia&gt;');
  expect(svg).not.toContain('<Cia>');
  expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
});

it('brings a node dragged outside the drawing back inside the exported canvas', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: -300,
          y: -200,
          title: 'Dragged out',
          body: null,
        },
      ],
      edges: [],
    },
    options,
  );

  // The bounds' corner lands exactly on the padding: -300 shifted by +540, -200 by +440.
  expect(svg).toContain(`x="${BOARD_CANVAS_PADDING}"`);
  expect(svg).toContain(`y="${BOARD_CANVAS_PADDING}"`);
  // And the node is never drawn at its raw negative coordinates.
  expect(svg).not.toContain('x="-300"');
  expect(svg).not.toContain('y="-200"');
});
