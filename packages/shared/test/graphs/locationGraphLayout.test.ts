import { describe, expect, it } from 'vitest';
import {
  buildLocationGraphLayout,
  GRAPH_PADDING,
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphLocation,
  type GraphLocationRelation,
  type LocationRelationKind,
} from '../../graphs/locationGraphLayout';

const location = (id: string, name = `Local ${id}`): GraphLocation => ({ id, name });

const rel = (
  id: string,
  locationAId: string,
  locationBId: string,
  relationType: LocationRelationKind = 'contains',
): GraphLocationRelation => ({ id, locationAId, locationBId, relationType });

const byId = (layout: { nodes: { id: string }[] }) =>
  new Map(layout.nodes.map((node) => [node.id, node as any]));

describe('buildLocationGraphLayout', () => {
  it('returns an empty canvas of just the padding when there are no locations', () => {
    expect(buildLocationGraphLayout([], [])).toMatchObject({
      nodes: [],
      edges: [],
      width: GRAPH_PADDING * 2,
      height: GRAPH_PADDING * 2,
      treeCount: 0,
      isolatedCount: 0,
    });
  });

  it('sends a location with no relations at all to the isolated grid', () => {
    const layout = buildLocationGraphLayout([location('a')], []);

    expect(layout).toMatchObject({ treeCount: 0, isolatedCount: 1 });
    expect(layout.nodes[0]).toMatchObject({ id: 'a', depth: 0, isIsolated: true });
  });

  it('treats a location that only has a connected_to edge as a tree, not isolated', () => {
    const layout = buildLocationGraphLayout(
      [location('a'), location('b')],
      [rel('r1', 'a', 'b', 'connected_to')],
    );

    expect(layout.isolatedCount).toBe(0);
    expect(layout.treeCount).toBe(2);
    expect(layout.nodes.every((node) => !node.isIsolated)).toBe(true);
  });

  it('stacks a contains child one layer below its parent', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('cidade')],
      [rel('r1', 'reino', 'cidade')],
    );
    const nodes = byId(layout);

    expect(nodes.get('reino').depth).toBe(0);
    expect(nodes.get('cidade').depth).toBe(1);
    expect(nodes.get('cidade').y).toBeGreaterThan(nodes.get('reino').y);
  });

  it('places a contains child to the right of its parent in a wide layout', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('cidade')],
      [rel('r1', 'reino', 'cidade')],
      'left-to-right',
    );
    const nodes = byId(layout);

    expect(nodes.get('cidade').x).toBeGreaterThan(nodes.get('reino').x);
  });

  it('counts one tree per root, not per node', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('cidade'), location('vila')],
      [rel('r1', 'reino', 'cidade'), rel('r2', 'cidade', 'vila')],
    );

    expect(layout.treeCount).toBe(1);
    expect(layout.nodes).toHaveLength(3);
    expect(byId(layout).get('vila').depth).toBe(2);
  });

  it('centres a parent above its children', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('a', 'Alfa'), location('b', 'Beta')],
      [rel('r1', 'reino', 'a'), rel('r2', 'reino', 'b')],
    );
    const nodes = byId(layout);

    const centre = (node: any) => node.x + node.width / 2;
    expect(centre(nodes.get('reino'))).toBeCloseTo(
      (centre(nodes.get('a')) + centre(nodes.get('b'))) / 2,
      1,
    );
  });

  it('orders siblings by name, so the drawing is stable', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('z', 'Zeta'), location('a', 'Alfa')],
      [rel('r1', 'reino', 'z'), rel('r2', 'reino', 'a')],
    );
    const nodes = byId(layout);

    expect(nodes.get('a').x).toBeLessThan(nodes.get('z').x);
  });

  it('ignores relations whose endpoints were already deleted', () => {
    const layout = buildLocationGraphLayout(
      [location('a')],
      [rel('r1', 'a', 'sumiu'), rel('r2', 'foi', 'embora', 'connected_to')],
    );

    expect(layout.edges).toEqual([]);
    expect(layout.nodes[0].isIsolated).toBe(true);
  });

  it('keeps the two relation kinds distinguishable on the edges', () => {
    const layout = buildLocationGraphLayout(
      [location('a'), location('b'), location('c')],
      [rel('r1', 'a', 'b'), rel('r2', 'b', 'c', 'connected_to')],
    );

    const kinds = layout.edges.map((edge) => edge.relationType).sort();
    expect(kinds).toEqual(['connected_to', 'contains']);
    expect(
      layout.edges.every((edge) => /^M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+$/.test(edge.path)),
    ).toBe(true);
  });

  it('does not let a connected_to edge change where nodes land', () => {
    const locations = [location('reino'), location('cidade'), location('vila')];
    const tree = [rel('r1', 'reino', 'cidade'), rel('r2', 'reino', 'vila')];

    const withoutConnection = buildLocationGraphLayout(locations, tree);
    const withConnection = buildLocationGraphLayout(locations, [
      ...tree,
      rel('r3', 'cidade', 'vila', 'connected_to'),
    ]);

    expect(withConnection.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
      withoutConnection.nodes.map(({ id, x, y }) => ({ id, x, y })),
    );
  });

  it('stops descending on a corrupted contains cycle instead of recursing forever', () => {
    // A cycle reachable from a root: 'a' contains 'b', and 'b'/'c' contain each other.
    const layout = buildLocationGraphLayout(
      [location('a'), location('b'), location('c')],
      [rel('r1', 'a', 'b'), rel('r2', 'b', 'c'), rel('r3', 'c', 'b')],
    );

    const ids = layout.nodes.map((node) => node.id);
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
    expect(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
      true,
    );
  });

  /**
   * In a closed `contains` cycle every location has a parent, so none is a root by the normal
   * criterion. Without an elected root, the whole map would come out empty - the worst possible result,
   * because it would hide both the problem and the rest of the story.
   */
  it('still draws a group whose locations all sit inside a closed contains cycle', () => {
    const layout = buildLocationGraphLayout(
      [location('a'), location('b')],
      [rel('r1', 'a', 'b'), rel('r2', 'b', 'a')],
    );

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['a', 'b']);
    expect(layout.treeCount).toBe(1);
  });

  it('elects the lowest id as the fallback root, so the drawing stays deterministic', () => {
    const cycle = [rel('r1', 'z', 'm'), rel('r2', 'm', 'a'), rel('r3', 'a', 'z')];

    const layout = buildLocationGraphLayout([location('z'), location('m'), location('a')], cycle);
    const roots = layout.nodes.filter((node) => node.depth === 0).map((node) => node.id);

    expect(roots).toEqual(['a']);
    expect(buildLocationGraphLayout([location('a'), location('m'), location('z')], cycle)).toEqual(
      layout,
    );
  });

  it('keeps drawing the healthy locations when only part of the story is cyclic', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('cidade'), location('x'), location('y')],
      [rel('r1', 'reino', 'cidade'), rel('r2', 'x', 'y'), rel('r3', 'y', 'x')],
    );

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['cidade', 'reino', 'x', 'y']);
  });

  it('draws a location reached by two contains parents only once', () => {
    const layout = buildLocationGraphLayout(
      [location('reino'), location('ducado'), location('vila')],
      [rel('r1', 'reino', 'vila'), rel('r2', 'ducado', 'vila')],
    );

    const ids = layout.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('vila');
  });

  it('never overlaps two nodes', () => {
    const locations = Array.from({ length: 16 }, (_, index) =>
      location(`l${index}`, `Local ${index}`),
    );
    const relations = [
      rel('r1', 'l0', 'l1'),
      rel('r2', 'l0', 'l2'),
      rel('r3', 'l1', 'l3'),
      rel('r4', 'l4', 'l5'),
      rel('r5', 'l6', 'l7', 'connected_to'),
    ];

    const layout = buildLocationGraphLayout(locations, relations);

    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        const overlaps =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlaps ? `${a.id}/${b.id}` : 'ok').toBe('ok');
      }
    }
  });

  it('keeps every node inside the reported canvas, respecting the padding', () => {
    const locations = Array.from({ length: 12 }, (_, index) => location(`l${index}`));
    const layout = buildLocationGraphLayout(locations, [
      rel('r1', 'l0', 'l1'),
      rel('r2', 'l0', 'l2'),
    ]);

    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(node.y).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width - GRAPH_PADDING + 0.01);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height - GRAPH_PADDING + 0.01);
    }
  });

  it('gives every node the same fixed box size and wraps long names', () => {
    const layout = buildLocationGraphLayout(
      [location('a', 'A Cidadela Branca de Minas Tirith')],
      [],
    );

    expect(layout.nodes[0]).toMatchObject({ width: NODE_WIDTH, height: NODE_HEIGHT });
    expect(layout.nodes[0].labelLines.length).toBeLessThanOrEqual(2);
  });

  it('is deterministic for the same input', () => {
    const locations = Array.from({ length: 10 }, (_, index) => location(`l${index}`));
    const relations = [
      rel('r1', 'l0', 'l1'),
      rel('r2', 'l1', 'l2'),
      rel('r3', 'l5', 'l6', 'connected_to'),
    ];

    expect(buildLocationGraphLayout(locations, relations)).toEqual(
      buildLocationGraphLayout(locations, relations),
    );
  });

  it('handles a deep chain without blowing the call stack', () => {
    const locations = Array.from({ length: 400 }, (_, index) => location(`l${index}`));
    const relations = locations.slice(1).map((l, index) => rel(`r${index}`, `l${index}`, l.id));

    const layout = buildLocationGraphLayout(locations, relations);

    expect(layout.nodes).toHaveLength(400);
    expect(Number.isFinite(layout.height)).toBe(true);
  });
});
