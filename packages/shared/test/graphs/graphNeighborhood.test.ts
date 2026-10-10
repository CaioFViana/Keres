import { describe, expect, it } from 'vitest';
import {
  filterByNeighborhood,
  focusNeighborhood,
  limitFocusSelection,
  MAX_FOCUS_SELECTION,
  neighborIds,
  touchesAny,
} from '../../graphs/graphNeighborhood';

type Edge = { id: string; from: string; to: string };
const ends = (edge: Edge) => [edge.from, edge.to] as const;
const edge = (id: string, from: string, to: string): Edge => ({ id, from, to });
const node = (id: string) => ({ id });

// a - b - c - d, and e alone.
const EDGES = [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cd', 'c', 'd')];
const NODES = ['a', 'b', 'c', 'd', 'e'].map(node);

describe('neighborIds', () => {
  it('finds who is directly connected, in either direction of the edge', () => {
    expect([...neighborIds(EDGES, ends, ['b'])].sort()).toEqual(['a', 'c']);
    expect([...neighborIds(EDGES, ends, ['a'])]).toEqual(['b']);
  });

  it('finds nothing for a node with no edges or an unknown one', () => {
    expect(neighborIds(EDGES, ends, ['e']).size).toBe(0);
    expect(neighborIds(EDGES, ends, ['zzz']).size).toBe(0);
    expect(neighborIds([], ends, ['a']).size).toBe(0);
  });

  it('pools the neighbours of several nodes', () => {
    expect([...neighborIds(EDGES, ends, ['a', 'd'])].sort()).toEqual(['b', 'c']);
  });
});

describe('focusNeighborhood', () => {
  it('is the focused nodes plus their direct neighbours', () => {
    expect([...focusNeighborhood(EDGES, ends, ['b'])].sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not reach neighbours of neighbours', () => {
    expect(focusNeighborhood(EDGES, ends, ['a']).has('c')).toBe(false);
  });

  it('keeps an isolated focused node on its own', () => {
    expect([...focusNeighborhood(EDGES, ends, ['e'])]).toEqual(['e']);
  });
});

describe('filterByNeighborhood', () => {
  it('keeps everything when nothing is selected', () => {
    const result = filterByNeighborhood(NODES, EDGES, ends, []);

    expect(result.nodes).toBe(NODES);
    expect(result.edges).toBe(EDGES);
  });

  it('keeps the selection, its neighbours and the edges among them', () => {
    const result = filterByNeighborhood(NODES, EDGES, ends, ['b']);

    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(result.edges.map((e) => e.id)).toEqual(['ab', 'bc']);
  });

  it('keeps an edge between two neighbours, and drops one that reaches outside', () => {
    const triangle = [
      edge('ab', 'a', 'b'),
      edge('ac', 'a', 'c'),
      edge('bc', 'b', 'c'),
      edge('cd', 'c', 'd'),
    ];

    const result = filterByNeighborhood(['a', 'b', 'c', 'd'].map(node), triangle, ends, ['a']);

    expect(result.edges.map((e) => e.id)).toEqual(['ab', 'ac', 'bc']);
  });

  it('ignores unknown ids and keeps the original order', () => {
    const result = filterByNeighborhood(NODES, EDGES, ends, ['zzz', 'c']);

    expect(result.nodes.map((n) => n.id)).toEqual(['b', 'c', 'd']);
  });
});

describe('touchesAny', () => {
  it('is true for an edge with an end in the set, on either side', () => {
    const set = new Set(['b']);

    expect(touchesAny(EDGES[0], ends, set)).toBe(true);
    expect(touchesAny(EDGES[1], ends, set)).toBe(true);
    expect(touchesAny(EDGES[2], ends, set)).toBe(false);
  });
});

describe('limitFocusSelection', () => {
  it('lets a short selection through whole', () => {
    expect(limitFocusSelection(['a', 'b'])).toEqual({ ids: ['a', 'b'], truncated: false });
  });

  it('cuts a long selection to the limit and says so', () => {
    const many = Array.from({ length: MAX_FOCUS_SELECTION + 3 }, (_, i) => `n${i}`);

    const result = limitFocusSelection(many);

    expect(result.ids).toHaveLength(MAX_FOCUS_SELECTION);
    expect(result.truncated).toBe(true);
  });

  it('does not call a selection of exactly the limit truncated', () => {
    const exact = Array.from({ length: MAX_FOCUS_SELECTION }, (_, i) => `n${i}`);

    expect(limitFocusSelection(exact).truncated).toBe(false);
  });
});
