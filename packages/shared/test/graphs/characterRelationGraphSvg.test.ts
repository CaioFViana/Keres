import { describe, expect, it } from 'vitest';
import { buildCharacterRelationGraphLayout } from '../../graphs/characterRelationGraphLayout';
import {
  renderCharacterRelationMapSvg,
  type CharacterRelationMapSvgOptions,
} from '../../graphs/characterRelationGraphSvg';

const options = (
  overrides: Partial<CharacterRelationMapSvgOptions> = {},
): CharacterRelationMapSvgOptions => ({
  title: 'A Queda',
  subtitle: '3 personagens, 2 relações',
  showEdgeLabels: true,
  labels: { isolated: 'Sem relações' },
  colors: {
    background: '#ffffff',
    surface: '#f2f2f2',
    text: '#111111',
    textSecondary: '#666666',
    border: '#cccccc',
    primaryContainer: '#dde7ff',
    primary: '#0B6E99',
  },
  ...overrides,
});

const layoutOf = (characters: { id: string; name: string }[], relations: any[] = []) =>
  buildCharacterRelationGraphLayout(characters, relations);

const connected = () =>
  layoutOf(
    [
      { id: 'a', name: 'Aragorn' },
      { id: 'b', name: 'Boromir' },
    ],
    [{ id: 'r1', character1Id: 'a', character2Id: 'b', relationType: 'aliado' }],
  );

describe('renderCharacterRelationMapSvg', () => {
  it('emits a standalone SVG document with an XML declaration', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options());

    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('opens and closes every tag it emits', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options());

    for (const tag of ['svg', 'title', 'g']) {
      expect(svg.split(`<${tag}`).length - 1).toBe(svg.split(`</${tag}>`).length - 1);
    }
  });

  it('declares a viewBox matching its width and height', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options());
    const [, width, height] = svg.match(/<svg [^>]*width="([\d.]+)" height="([\d.]+)"/)!;

    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
  });

  it('reserves room for the header above the graph', () => {
    const layout = connected();
    const svg = renderCharacterRelationMapSvg(layout, options());
    const [, height] = svg.match(/<svg [^>]*height="([\d.]+)"/)!;

    expect(Number(height)).toBeGreaterThan(layout.height);
  });

  it('escapes a title containing XML metacharacters', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options({ title: 'Tolkien & <Cia>' }));

    expect(svg).toContain('<title>Tolkien &amp; &lt;Cia&gt;</title>');
    expect(svg).not.toContain('<Cia>');
  });

  it('escapes a character name typed by the author', () => {
    const layout = layoutOf([{ id: 'a', name: 'A & B' }]);

    const svg = renderCharacterRelationMapSvg(layout, options());

    expect(svg).toContain('A &amp; B');
  });

  it.each([
    ['ampersand', '&', '&amp;'],
    ['less than', '<', '&lt;'],
    ['greater than', '>', '&gt;'],
    ['double quote', '"', '&quot;'],
    ['single quote', "'", '&apos;'],
  ])('escapes a bare %s in the relation label', (_label, raw, escaped) => {
    const layout = layoutOf(
      [
        { id: 'a', name: 'Ana' },
        { id: 'b', name: 'Bia' },
      ],
      [{ id: 'r1', character1Id: 'a', character2Id: 'b', relationType: `x${raw}y` }],
    );

    expect(renderCharacterRelationMapSvg(layout, options())).toContain(`x${escaped}y`);
  });

  it('draws every node and every edge of the layout', () => {
    const layout = connected();
    const svg = renderCharacterRelationMapSvg(layout, options());

    expect(svg.split('<rect').length - 1).toBeGreaterThanOrEqual(layout.nodes.length);
    for (const edge of layout.edges) {
      expect(svg).toContain(`d="${edge.path}"`);
    }
  });

  it('omits relation labels when the caller turns them off', () => {
    const layout = connected();

    expect(renderCharacterRelationMapSvg(layout, options({ showEdgeLabels: true }))).toContain(
      'aliado',
    );
    expect(renderCharacterRelationMapSvg(layout, options({ showEdgeLabels: false }))).not.toContain(
      'aliado',
    );
  });

  it('only shows the isolated legend when there is an isolated character', () => {
    const withIsolated = layoutOf([{ id: 'a', name: 'Ana' }]);

    expect(renderCharacterRelationMapSvg(withIsolated, options())).toContain('Sem relações');
    expect(renderCharacterRelationMapSvg(connected(), options())).not.toContain('Sem relações');
  });

  it('grows the canvas for the legend row', () => {
    const heightOf = (svg: string) => Number(svg.match(/<svg [^>]*height="([\d.]+)"/)![1]);
    const isolated = layoutOf([{ id: 'a', name: 'Ana' }]);
    const withoutLegend = connected();

    expect(heightOf(renderCharacterRelationMapSvg(isolated, options()))).toBeGreaterThan(
      isolated.height +
        (heightOf(renderCharacterRelationMapSvg(withoutLegend, options())) - withoutLegend.height) -
        1,
    );
  });

  it('truncates an overly long relation label instead of overflowing the drawing', () => {
    const layout = layoutOf(
      [
        { id: 'a', name: 'Ana' },
        { id: 'b', name: 'Bia' },
      ],
      [{ id: 'r1', character1Id: 'a', character2Id: 'b', relationType: 'x'.repeat(80) }],
    );

    const svg = renderCharacterRelationMapSvg(layout, options());

    expect(svg).toContain('…');
    expect(svg).not.toContain('x'.repeat(40));
  });

  it('renders an empty story without producing a broken document', () => {
    const svg = renderCharacterRelationMapSvg(layoutOf([]), options());

    expect(svg).toContain('<svg');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('uses the caller-provided theme colours', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options());

    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#cccccc"');
  });

  it('draws a highlighted node with the primary stroke', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options({ highlightedNodeIds: ['a'] }));

    expect(svg).toContain('stroke="#0B6E99"');
  });

  it('does not highlight any node without highlightedNodeIds', () => {
    const svg = renderCharacterRelationMapSvg(connected(), options());

    expect(svg).not.toContain('stroke="#0B6E99"');
  });

  it('is deterministic for the same layout and options', () => {
    const layout = connected();

    expect(renderCharacterRelationMapSvg(layout, options())).toBe(
      renderCharacterRelationMapSvg(layout, options()),
    );
  });
});
