/**
 * @jest-environment node
 */
import { renderLocationMapSvg } from '../../src/utils/locationMapSvg';

const content = {
  images: [{ id: '01ABCDEF', galleryId: 'gallery-1', x: 40, y: 40, width: 320, height: 240, locked: false }],
  nodes: [
    { id: '02GHJKMN', locationId: 'location-1', x: 400, y: 300, icon: 'pin', color: '#8BC34A' },
    { id: '03PQRSVW', locationId: 'location-2', x: 500, y: 300, icon: 'flag', color: '#F44336' },
  ],
};

const options = {
  title: 'Continente',
  subtitle: '2 locations · 1 image',
  colors: {
    background: '#ffffff',
    surface: '#f2f2f2',
    text: '#111111',
    textSecondary: '#666666',
    border: '#cccccc',
  },
  nodeNames: { 'location-1': 'Reino', 'location-2': 'Cidade' },
  connections: [{ locationAId: 'location-1', locationBId: 'location-2' }],
  contains: [{ parentLocationId: 'location-1', childLocationId: 'location-2' }],
};

it('emits a standalone SVG document', () => {
  const svg = renderLocationMapSvg(content, options);

  expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
});

it('embeds an image base as a data URI when provided', () => {
  const svg = renderLocationMapSvg(content, {
    ...options,
    imageUris: { 'gallery-1': 'data:image/png;base64,AAAA' },
  });

  expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
});

it('draws connected_to as a solid line and contains as a dashed arrow', () => {
  const svg = renderLocationMapSvg(content, options);

  // The connected_to line is solid (no dash array); the contains line is dashed with an arrow.
  expect(svg).toContain('stroke-opacity="0.85"/>');
  expect(svg).toContain('stroke-dasharray="6 4"');
  expect(svg).toContain('<polygon');
});

it('colours relation lines halfway between the two nodes', () => {
  const svg = renderLocationMapSvg(content, options);

  // #8BC34A and #F44336 interpolate to #c08340.
  expect(svg).toContain('stroke="#c08340"');
});

it('draws every node as a coloured circle with its name', () => {
  const svg = renderLocationMapSvg(content, options);

  expect(svg).toContain('stroke="#8BC34A"');
  expect(svg).toContain('stroke="#F44336"');
  expect(svg).toContain('>Reino</text>');
  expect(svg).toContain('>Cidade</text>');
});

it('draws each node icon as an ionicons path filled with the node colour', () => {
  const svg = renderLocationMapSvg(content, options);

  expect(svg).toContain('<g transform="translate(');
  expect(svg).toContain('fill="#8BC34A">');
  expect(svg).toContain('<path d="M336 96a80 80 0 1 0-96 78.39');
});

it('draws a contrast halo behind every line', () => {
  const svg = renderLocationMapSvg(content, options);

  // Each line is drawn twice: a thick background-coloured halo, then the coloured line.
  expect(svg).toContain('stroke="#ffffff" stroke-width="6"');
  expect(svg).toContain('stroke="#c08340"');
});

it('normalises nodes dragged to negative coordinates back inside the canvas', () => {
  const dragged = {
    images: [],
    nodes: [
      { id: '02GHJKMN', locationId: 'location-1', x: -300, y: -200, icon: 'pin', color: '#8BC34A' },
    ],
  };
  const svg = renderLocationMapSvg(dragged, options);

  expect(svg).toContain('>Reino</text>');
  // No raw negative coordinates: the drawing is shifted inside the viewBox.
  expect(svg).not.toContain('x="-300"');
  expect(svg).not.toContain('y="-200"');
  expect(svg).toContain('<circle cx="62" cy="62"');
});