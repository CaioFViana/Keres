/**
 * @jest-environment node
 */
import { renderBoardSvg } from '../../src/utils/boardSvg';

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

it('emits a standalone SVG and escapes the pin title', () => {
  const svg = renderBoardSvg(content, {
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
  });

  expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(svg).toContain('Tolkien &amp; &lt;Cia&gt;');
  expect(svg).not.toContain('<Cia>');
  expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
});
