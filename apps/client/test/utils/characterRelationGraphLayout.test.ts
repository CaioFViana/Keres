import {
  buildCharacterRelationGraphLayout,
  GRAPH_PADDING,
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphCharacter,
  type GraphRelation,
} from '../../src/utils/characterRelationGraphLayout';

const character = (id: string, name = `Personagem ${id}`): GraphCharacter => ({ id, name });

const relation = (
  id: string,
  charId1: string,
  charId2: string,
  relationType = 'irmão',
): GraphRelation => ({
  id,
  charId1,
  charId2,
  relationType,
});

/** Nós desenhados como retângulos: qualquer sobreposição é texto ilegível na tela. */
function overlappingPairs(
  nodes: { id: string; x: number; y: number; width: number; height: number }[],
) {
  const pairs: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const overlaps =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      if (overlaps) pairs.push(`${a.id}/${b.id}`);
    }
  }
  return pairs;
}

describe('buildCharacterRelationGraphLayout', () => {
  it('returns an empty canvas of just the padding when there are no characters', () => {
    const layout = buildCharacterRelationGraphLayout([], []);

    expect(layout).toMatchObject({
      nodes: [],
      edges: [],
      width: GRAPH_PADDING * 2,
      height: GRAPH_PADDING * 2,
      clusterCount: 0,
      isolatedCount: 0,
    });
  });

  it('places a lone character in the isolated grid rather than a cluster', () => {
    const layout = buildCharacterRelationGraphLayout([character('a')], []);

    expect(layout.clusterCount).toBe(0);
    expect(layout.isolatedCount).toBe(1);
    expect(layout.nodes[0]).toMatchObject({ id: 'a', degree: 0, isIsolated: true });
  });

  it('counts one cluster for a group of connected characters', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a'), character('b'), character('c')],
      [relation('r1', 'a', 'b'), relation('r2', 'b', 'c')],
    );

    expect(layout.clusterCount).toBe(1);
    expect(layout.isolatedCount).toBe(0);
    expect(layout.nodes.every((node) => !node.isIsolated)).toBe(true);
  });

  it('separates unrelated groups into their own clusters', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a'), character('b'), character('c'), character('d')],
      [relation('r1', 'a', 'b'), relation('r2', 'c', 'd')],
    );

    expect(layout.clusterCount).toBe(2);
  });

  it('reports the degree of each character', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('hub'), character('a'), character('b')],
      [relation('r1', 'hub', 'a'), relation('r2', 'hub', 'b')],
    );

    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    expect(byId.get('hub')!.degree).toBe(2);
    expect(byId.get('a')!.degree).toBe(1);
  });

  it('ignores a relation pointing at a character that was already deleted', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a')],
      [relation('r1', 'a', 'deleted'), relation('r2', 'gone', 'also-gone')],
    );

    expect(layout.edges).toEqual([]);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].isIsolated).toBe(true);
  });

  it('draws one straight edge per relation, between the two node ids', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a'), character('b')],
      [relation('r1', 'a', 'b', 'mãe')],
    );

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({ id: 'r1', sourceId: 'a', targetId: 'b', label: 'mãe' });
    expect(layout.edges[0].path).toMatch(
      /^M -?\d+(\.\d+)? -?\d+(\.\d+)? L -?\d+(\.\d+)? -?\d+(\.\d+)?$/,
    );
  });

  it('puts the relation label at the midpoint of its edge', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a'), character('b')],
      [relation('r1', 'a', 'b')],
    );

    const [, startX, startY, endX, endY] = layout.edges[0].path.match(
      /^M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) (-?[\d.]+)$/,
    )!;
    expect(layout.edges[0].labelPosition.x).toBeCloseTo((Number(startX) + Number(endX)) / 2, 1);
    expect(layout.edges[0].labelPosition.y).toBeCloseTo((Number(startY) + Number(endY)) / 2, 1);
  });

  it('keeps a self-relation from breaking the drawing', () => {
    const layout = buildCharacterRelationGraphLayout([character('a')], [relation('r1', 'a', 'a')]);

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0].sourceId).toBe('a');
    expect(Number.isNaN(layout.edges[0].labelPosition.x)).toBe(false);
  });

  it('never overlaps two nodes of the same cluster', () => {
    const characters = Array.from({ length: 12 }, (_, index) => character(`c${index}`));
    const relations = characters.slice(1).map((c, index) => relation(`r${index}`, 'c0', c.id));

    const layout = buildCharacterRelationGraphLayout(characters, relations);

    expect(overlappingPairs(layout.nodes)).toEqual([]);
  });

  it('never overlaps nodes across clusters and the isolated grid', () => {
    const characters = Array.from({ length: 14 }, (_, index) => character(`c${index}`));
    const relations = [
      relation('r1', 'c0', 'c1'),
      relation('r2', 'c1', 'c2'),
      relation('r3', 'c3', 'c4'),
      relation('r4', 'c4', 'c5'),
    ];

    const layout = buildCharacterRelationGraphLayout(characters, relations);

    expect(layout.clusterCount).toBe(2);
    expect(layout.isolatedCount).toBe(8);
    expect(overlappingPairs(layout.nodes)).toEqual([]);
  });

  it('keeps every node inside the reported canvas, respecting the padding', () => {
    const characters = Array.from({ length: 20 }, (_, index) => character(`c${index}`));
    const relations = [
      relation('r1', 'c0', 'c1'),
      relation('r2', 'c2', 'c3'),
      relation('r3', 'c3', 'c4'),
    ];

    const layout = buildCharacterRelationGraphLayout(characters, relations);

    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(node.y).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width - GRAPH_PADDING + 0.01);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height - GRAPH_PADDING + 0.01);
    }
  });

  it('gives every node the same fixed box size', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a'), character('b')],
      [relation('r1', 'a', 'b')],
    );

    expect(
      layout.nodes.every((node) => node.width === NODE_WIDTH && node.height === NODE_HEIGHT),
    ).toBe(true);
  });

  it('wraps a long character name into at most two lines', () => {
    const layout = buildCharacterRelationGraphLayout(
      [character('a', 'Aragorn filho de Arathorn, herdeiro de Isildur')],
      [],
    );

    expect(layout.nodes[0].labelLines.length).toBeLessThanOrEqual(2);
    expect(layout.nodes[0].labelLines.length).toBeGreaterThan(0);
  });

  it('is deterministic, so the same story always draws the same map', () => {
    const characters = Array.from({ length: 10 }, (_, index) => character(`c${index}`));
    const relations = [
      relation('r1', 'c0', 'c1'),
      relation('r2', 'c1', 'c2'),
      relation('r3', 'c5', 'c6'),
    ];

    const first = buildCharacterRelationGraphLayout(characters, relations);
    const second = buildCharacterRelationGraphLayout(characters, relations);

    expect(first).toEqual(second);
  });

  it('handles a large graph without blowing the call stack', () => {
    const characters = Array.from({ length: 2000 }, (_, index) => character(`c${index}`));
    const relations = characters
      .slice(1)
      .map((c, index) => relation(`r${index}`, `c${index}`, c.id));

    const layout = buildCharacterRelationGraphLayout(characters, relations);

    expect(layout.nodes).toHaveLength(2000);
    expect(Number.isFinite(layout.width)).toBe(true);
  });
});
