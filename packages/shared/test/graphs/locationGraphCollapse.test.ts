import { describe, expect, it } from 'vitest';
import { collapseLocationGraph } from '../../graphs/locationGraphCollapse';
import type {
  GraphLocation,
  GraphLocationRelation,
  LocationRelationKind,
} from '../../graphs/locationGraphLayout';

const place = (id: string): GraphLocation => ({ id, name: id });
const rel = (
  id: string,
  a: string,
  b: string,
  relationType: LocationRelationKind = 'contains',
): GraphLocationRelation => ({ id, locationAId: a, locationBId: b, relationType });
const idsOf = (list: { id: string }[]) => list.map((x) => x.id);

// world > (north > (keep, village), south), and a loose road from village to south.
const PLACES = ['world', 'north', 'south', 'keep', 'village', 'lone'].map(place);
const RELATIONS = [
  rel('w-n', 'world', 'north'),
  rel('w-s', 'world', 'south'),
  rel('n-k', 'north', 'keep'),
  rel('n-v', 'north', 'village'),
  rel('road', 'village', 'south', 'connected_to'),
];

describe('collapseLocationGraph', () => {
  it('changes nothing when nothing is folded', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, []);

    expect(result.locations).toBe(PLACES);
    expect(result.relations).toBe(RELATIONS);
    expect(result.hiddenCounts.size).toBe(0);
  });

  it('hides what a folded place holds, and counts it', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, ['north']);

    expect(idsOf(result.locations)).toEqual(['world', 'north', 'south', 'lone']);
    expect(result.hiddenCounts.get('north')).toBe(2);
  });

  it('hides everything below, not only the children', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, ['world']);

    expect(idsOf(result.locations)).toEqual(['world', 'lone']);
    expect(result.hiddenCounts.get('world')).toBe(4);
  });

  it('takes along the lines that would end in a hidden place', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, ['north']);

    // The road from the village to the south, and the lines to the keep and the village, are gone.
    expect(idsOf(result.relations)).toEqual(['w-n', 'w-s']);
  });

  it('keeps a loose line between places that stay visible', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, ['south']);

    // The south holds nothing, so nothing is hidden and the road stays.
    expect(idsOf(result.relations)).toContain('road');
    expect(result.hiddenCounts.has('south')).toBe(false);
  });

  it('counts a fold inside a fold only once, on the one that is still visible', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, ['north', 'world']);

    expect(idsOf(result.locations)).toEqual(['world', 'lone']);
    expect([...result.hiddenCounts.entries()]).toEqual([['world', 4]]);
  });

  it('ignores ids that are not on the map', () => {
    const result = collapseLocationGraph(PLACES, RELATIONS, ['nowhere']);

    expect(idsOf(result.locations)).toEqual(idsOf(PLACES));
    expect(result.hiddenCounts.size).toBe(0);
  });

  it('does not hang on a loop of contains', () => {
    const loop = [rel('a-b', 'a', 'b'), rel('b-a', 'b', 'a')];

    const result = collapseLocationGraph(['a', 'b'].map(place), loop, ['a']);

    expect(idsOf(result.locations)).toEqual(['a']);
    expect(result.hiddenCounts.get('a')).toBe(1);
  });

  it('keeps the original order of what stays', () => {
    const result = collapseLocationGraph([...PLACES].reverse(), RELATIONS, ['north']);

    expect(idsOf(result.locations)).toEqual(['lone', 'south', 'north', 'world']);
  });
});
