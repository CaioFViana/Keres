/**
 * @jest-environment node
 */
import { renderBoardSvg } from '../../src/utils/boardSvg';
import {
  BOARD_CANVAS_PADDING,
  BOARD_NODE_WIDTH,
  BOARD_NOTE_WIDTH,
} from '../../src/utils/boardLayout';

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

it('renders the note body text inside the exported note card', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: 40,
          y: 40,
          title: 'Reunião',
          body: 'Frodo e Sam encontram Gandalf na estrada.',
        },
      ],
      edges: [],
    },
    options,
  );

  // The body wraps to fit the note's width - both lines are present.
  expect(svg).toContain('Frodo e Sam encontram Gandalf');
  expect(svg).toContain('na estrada.');
  expect(svg).toContain(`width="${BOARD_NOTE_WIDTH}"`);
});

it('caps the note body at ten lines', () => {
  const body = Array.from({ length: 12 }, (_, index) => `linha ${index + 1}`).join('\n');
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: 40,
          y: 40,
          title: 'Reunião',
          body,
        },
      ],
      edges: [],
    },
    options,
  );

  expect(svg).toContain('linha 1');
  expect(svg).toContain('linha 10');
  expect(svg).not.toContain('linha 11');
});

it('truncates an overflowing note body with an ellipsis', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: 40,
          y: 40,
          title: 'Reunião',
          body: 'palavra '.repeat(60).trim(),
        },
      ],
      edges: [],
    },
    options,
  );

  expect(svg).toContain('…');
});

it('keeps entity pins at the standard size', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'entity' as const,
          x: 40,
          y: 40,
          entityType: 'Character',
          entityId: 'char-1',
          labelAtPin: 'Frodo',
        },
      ],
      edges: [],
    },
    options,
  );

  expect(svg).toContain(`width="${BOARD_NODE_WIDTH}"`);
  expect(svg).not.toContain(`width="${BOARD_NOTE_WIDTH}"`);
});
