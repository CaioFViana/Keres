/**
 * @jest-environment node
 */
import { renderLocationMapSvg } from '../../src/utils/locationMapSvg';

const content = {
  images: [{ id: '01ABCDEF', galleryId: 'gallery-1', x: 40, y: 40, width: 320, height: 240 }],
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

it('draws a dashed line for connected_to and a sawtooth arrow for contains', () => {
  const svg = renderLocationMapSvg(content, options);

  expect(svg).toContain('stroke-dasharray="6 4"');
  expect(svg).toContain('<polygon');
  expect(svg).toContain('L 500 300');
});

it('draws every node as a coloured circle with its name', () => {
  const svg = renderLocationMapSvg(content, options);

  expect(svg).toContain('stroke="#8BC34A"');
  expect(svg).toContain('stroke="#F44336"');
  expect(svg).toContain('>Reino</text>');
  expect(svg).toContain('>Cidade</text>');
});