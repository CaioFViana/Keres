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

it('uses a World Piece section colour for the exported card accent', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'entity' as const,
          x: 40,
          y: 40,
          entityType: 'WorldRule',
          entityId: 'rule-1',
          labelAtPin: 'Magic has a cost',
        },
      ],
      edges: [],
    },
    {
      ...options,
      titles: {
        '01ABCDEF': {
          title: 'Magic has a cost',
          typeLabel: 'World rules',
          appearance: { color: '#0277BD' },
        },
      },
    },
  );

  expect(svg).toContain('width="5" height="86" rx="2" fill="#0277BD"');
});

it('keeps a short note at the standard width', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: 40,
          y: 40,
          title: 'Reunião',
          body: 'Curto.',
        },
      ],
      edges: [],
    },
    options,
  );

  expect(svg).toContain(`width="${BOARD_NODE_WIDTH}"`);
  expect(svg).not.toContain(`width="${BOARD_NOTE_WIDTH}"`);
});

it('grows a Gallery pin with an image into a bigger card with a picture placeholder', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'entity' as const,
          x: 40,
          y: 40,
          entityType: 'Gallery',
          entityId: 'gal-1',
          labelAtPin: 'Capa',
        },
      ],
      edges: [],
    },
    {
      ...options,
      galleryMediaById: {
        'gal-1': {
          mediaType: 'image',
          mimeType: 'image/png',
          localPath: 'file:///a.png',
          thumbnailPath: null,
        },
      },
    },
  );

  expect(svg).toContain(`width="${BOARD_NOTE_WIDTH}"`);
  // Without embedded bytes a picture placeholder marks the image area.
  expect(svg).toContain('<circle');
});

it('embeds a gallery image as a data URI when the caller provides it', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'entity' as const,
          x: 40,
          y: 40,
          entityType: 'Gallery',
          entityId: 'gal-1',
          labelAtPin: 'Capa',
        },
      ],
      edges: [],
    },
    {
      ...options,
      galleryMediaById: {
        'gal-1': {
          mediaType: 'image',
          mimeType: 'image/png',
          localPath: 'file:///a.png',
          thumbnailPath: null,
        },
      },
      galleryImages: { 'gal-1': 'data:image/png;base64,AAAA' },
    },
  );

  expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
  expect(svg).not.toContain('<circle');
});

it('truncates an overly long pin title so it stays inside the card', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: 40,
          y: 40,
          title: 'Um título absurdamente longo que não cabe no cartão',
          body: null,
        },
      ],
      edges: [],
    },
    {
      ...options,
      titles: {
        '01ABCDEF': {
          title: 'Um título absurdamente longo que não cabe no cartão',
          typeLabel: 'Note',
        },
      },
    },
  );

  expect(svg).toContain('…');
  expect(svg).not.toContain('não cabe no cartão');
});

it('gives an edge label an opaque background with a border', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note' as const,
          x: 40,
          y: 40,
          title: 'A',
          body: null,
        },
        {
          id: '02GHIJKL',
          kind: 'note' as const,
          x: 400,
          y: 40,
          title: 'B',
          body: null,
        },
      ],
      edges: [{ id: 'e1', from: '01ABCDEF', to: '02GHIJKL', directed: true, label: 'liga' }],
    },
    options,
  );

  expect(svg).toContain('fill="#ffffff" fill-opacity="0.92" stroke="#cccccc"');
  expect(svg).toContain('>liga</text>');
});

it('keeps a Gallery pin without an image at the standard size', () => {
  const svg = renderBoardSvg(
    {
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'entity' as const,
          x: 40,
          y: 40,
          entityType: 'Gallery',
          entityId: 'gal-1',
          labelAtPin: 'Contrato',
        },
      ],
      edges: [],
    },
    {
      ...options,
      galleryMediaById: {
        'gal-1': {
          mediaType: 'document',
          mimeType: 'application/pdf',
          localPath: null,
          thumbnailPath: null,
        },
      },
    },
  );

  expect(svg).toContain(`width="${BOARD_NODE_WIDTH}"`);
  expect(svg).not.toContain(`width="${BOARD_NOTE_WIDTH}"`);
  expect(svg).not.toContain('<circle');
});
