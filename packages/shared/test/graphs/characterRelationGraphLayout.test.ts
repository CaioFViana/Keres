import { describe, expect, it } from 'vitest';
import { edgeLabelRect } from '../../graphs/edgeLabelPlacement';
import {
  buildCharacterRelationGraphLayout,
  GRAPH_PADDING,
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphCharacter,
  type GraphRelation,
} from '../../graphs/characterRelationGraphLayout';

const character = (id: string, name = `Personagem ${id}`): GraphCharacter => ({ id, name });

const relation = (
  id: string,
  character1Id: string,
  character2Id: string,
  relationType = 'irmão',
): GraphRelation => ({
  id,
  character1Id,
  character2Id,
  relationType,
});

/** Nodes drawn as rectangles: any overlap is illegible text on the screen. */
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

  describe('a hub in the middle of a larger group', () => {
    const star = (spokes: number) =>
      buildCharacterRelationGraphLayout(
        [character('hub'), ...Array.from({ length: spokes }, (_, i) => character(`s${i}`))],
        Array.from({ length: spokes }, (_, i) => relation(`r${i}`, 'hub', `s${i}`)),
      );
    type Box = { x: number; y: number; width: number; height: number };
    const centre = (n: Box) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    it('puts the most connected character in the middle and the others on a ring, wider than tall, around it', () => {
      const layout = star(7);
      const hub = centre(layout.nodes.find((n) => n.id === 'hub')!);
      // On an ellipse 1.4 times wider than tall, undoing the stretch gives one distance for all.
      const distances = layout.nodes
        .filter((n) => n.id !== 'hub')
        .map((n) => {
          const c = centre(n);
          return Math.hypot((c.x - hub.x) / 1.4, c.y - hub.y);
        });

      expect(distances).toHaveLength(7);
      for (const d of distances) expect(d).toBeCloseTo(distances[0], 6);
      expect(distances[0] * 1.4).toBeGreaterThan(NODE_WIDTH);
    });

    it('does not overlap, however many spokes there are', () => {
      for (const spokes of [3, 4, 5, 12, 40]) {
        expect(overlappingPairs(star(spokes).nodes)).toEqual([]);
      }
    });

    it('keeps a group of three on a plain circle, with nobody in the middle', () => {
      const layout = star(2);
      const points = layout.nodes.map(centre);
      const middle = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      };
      // On a circle every node is as far from the middle as the others; none is at the middle.
      const distances = points.map((p) => distance(p, middle));
      for (const d of distances) expect(d).toBeGreaterThan(NODE_HEIGHT);
    });

    it('starts the ring with the neighbours of the hub, so its first relations are the nearest in the ring', () => {
      const layout = star(5);
      const top = layout.nodes
        .filter((n) => n.id !== 'hub')
        .sort((a, b) => centre(a).y - centre(b).y)[0];

      expect(top.id).toBe('s0');
    });
  });

  describe('the labels of the relations', () => {
    type Box = { x: number; y: number; width: number; height: number };
    const plateOf = (edge: { label: string; labelPosition: { x: number; y: number } }): Box => {
      const rect = edgeLabelRect(edge.labelPosition, edge.label);
      return rect;
    };
    const touches = (a: Box, b: Box) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const long = 'Followed him because';

    /** The labels a reader cannot read: a plate under a node, or two plates on one another. */
    function hiddenLabels(layout: ReturnType<typeof buildCharacterRelationGraphLayout>) {
      const hidden: string[] = [];
      for (const edge of layout.edges) {
        const plate = plateOf(edge);
        if (layout.nodes.some((node) => touches(plate, node)))
          hidden.push(`${edge.id} under a node`);
      }
      for (let i = 0; i < layout.edges.length; i++) {
        for (let j = i + 1; j < layout.edges.length; j++) {
          if (touches(plateOf(layout.edges[i]), plateOf(layout.edges[j]))) {
            hidden.push(`${layout.edges[i].id}/${layout.edges[j].id} on each other`);
          }
        }
      }
      return hidden;
    }

    it('leaves room for the label of every spoke around a hub, however long it is', () => {
      const layout = buildCharacterRelationGraphLayout(
        [character('hub'), ...Array.from({ length: 5 }, (_, i) => character(`s${i}`))],
        Array.from({ length: 5 }, (_, i) => relation(`r${i}`, 'hub', `s${i}`, long)),
      );

      expect(hiddenLabels(layout)).toEqual([]);
    });

    it('leaves room for the label of a group of two and of three', () => {
      const two = buildCharacterRelationGraphLayout(
        [character('a'), character('b')],
        [relation('r1', 'a', 'b', long)],
      );
      const three = buildCharacterRelationGraphLayout(
        [character('a'), character('b'), character('c')],
        [
          relation('r1', 'a', 'b', long),
          relation('r2', 'b', 'c', long),
          relation('r3', 'a', 'c', long),
        ],
      );

      expect(hiddenLabels(two)).toEqual([]);
      expect(hiddenLabels(three)).toEqual([]);
    });

    it('keeps the labels of lines that cross apart', () => {
      // A hub with a ring where the ring nodes are also related: some lines cross near the middle.
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const layout = buildCharacterRelationGraphLayout(
        [character('hub'), ...ids.map((id) => character(id))],
        [
          ...ids.map((id) => relation(`h${id}`, 'hub', id, 'Defied her')),
          relation('ac', 'a', 'c', 'Accuser'),
          relation('bd', 'b', 'd', 'Uninvited guest'),
          relation('ce', 'c', 'e', 'Introduced by her'),
        ],
      );

      expect(hiddenLabels(layout)).toEqual([]);
    });

    it('puts characters related to one another side by side on the ring', () => {
      const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
      const layout = buildCharacterRelationGraphLayout(
        [character('hub'), ...ids.map((id) => character(id))],
        [
          ...ids.map((id) => relation(`h${id}`, 'hub', id)),
          relation('ad', 'a', 'd'),
          relation('be', 'b', 'e'),
        ],
      );
      const hub = layout.nodes.find((n) => n.id === 'hub')!;
      const angleOf = (id: string) => {
        const n = layout.nodes.find((node) => node.id === id)!;
        return Math.atan2(
          n.y + n.height / 2 - (hub.y + hub.height / 2),
          (n.x + n.width / 2 - (hub.x + hub.width / 2)) / 1.4,
        );
      };
      const ringGap = (x: string, y: string) => {
        const diff = Math.abs(angleOf(x) - angleOf(y));
        return Math.min(diff, Math.PI * 2 - diff);
      };

      // Adjacent on a ring of six is 60 degrees; a line to the far side would be 180.
      expect(ringGap('a', 'd')).toBeLessThan((Math.PI * 2) / 6 + 0.01);
      expect(ringGap('b', 'e')).toBeLessThan((Math.PI * 2) / 6 + 0.01);
    });
  });
});
