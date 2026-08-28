import { describe, expect, it } from 'vitest';
import type {
  GraphLocation,
  GraphLocationRelation,
  LocationRelationKind,
} from '../../graphs/locationGraphLayout';
import { buildLocationGraphLayout } from '../../graphs/locationGraphLayout';
import { filterLocationGraph } from '../../graphs/locationGraphFilter';

const location = (id: string, name = `Local ${id}`): GraphLocation => ({ id, name });

const relation = (
  id: string,
  locationAId: string,
  locationBId: string,
  relationType: LocationRelationKind = 'connected_to',
): GraphLocationRelation => ({
  id,
  locationAId,
  locationBId,
  relationType,
});

const idsOf = (locations: GraphLocation[]) => locations.map((location) => location.id);

describe('filterLocationGraph', () => {
  it('keeps everything when nothing is selected', () => {
    const locations = [location('a'), location('b'), location('c')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterLocationGraph(locations, relations, []);

    expect(filtered.locations).toEqual(locations);
    expect(filtered.relations).toEqual(relations);
  });

  it('keeps the selected locations and their direct neighbours, dropping everyone else', () => {
    const locations = [location('a'), location('b'), location('c'), location('d')];
    const relations = [
      relation('r1', 'a', 'b'),
      relation('r2', 'b', 'c'),
      relation('r3', 'c', 'd'),
    ];

    const filtered = filterLocationGraph(locations, relations, ['a']);

    expect(idsOf(filtered.locations)).toEqual(['a', 'b']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('does not pull in neighbours of neighbours', () => {
    const locations = [location('a'), location('b'), location('c')];
    const relations = [relation('r1', 'a', 'b'), relation('r2', 'b', 'c')];

    const filtered = filterLocationGraph(locations, relations, ['a']);

    expect(idsOf(filtered.locations)).toEqual(['a', 'b']);
  });

  it('treats a contains relation as a connection in both directions', () => {
    const locations = [location('reino'), location('cidade')];
    const relations = [relation('r1', 'reino', 'cidade', 'contains')];

    const filtered = filterLocationGraph(locations, relations, ['cidade']);

    expect(idsOf(filtered.locations)).toEqual(['reino', 'cidade']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('keeps a relation between two neighbours when both are in the kept set', () => {
    const locations = [location('a'), location('b'), location('c')];
    const relations = [
      relation('r1', 'a', 'b'),
      relation('r2', 'a', 'c'),
      relation('r3', 'b', 'c'),
    ];

    const filtered = filterLocationGraph(locations, relations, ['a']);

    expect(idsOf(filtered.locations)).toEqual(['a', 'b', 'c']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('drops a relation that reaches outside the kept set', () => {
    const locations = [location('a'), location('b'), location('c')];
    const relations = [relation('r1', 'a', 'b'), relation('r2', 'b', 'c')];

    const filtered = filterLocationGraph(locations, relations, ['a']);

    expect(idsOf(filtered.locations)).toEqual(['a', 'b']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('keeps both selected locations and the relation between them', () => {
    const locations = [location('a'), location('b'), location('c')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterLocationGraph(locations, relations, ['a', 'b']);

    expect(idsOf(filtered.locations)).toEqual(['a', 'b']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('ignores selected ids that do not exist', () => {
    const locations = [location('a'), location('b')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterLocationGraph(locations, relations, ['ghost']);

    expect(filtered.locations).toEqual([]);
    expect(filtered.relations).toEqual([]);
  });

  it('preserves the original order of locations and relations', () => {
    const locations = [location('z'), location('a'), location('m')];
    const relations = [relation('r2', 'a', 'm'), relation('r1', 'z', 'a')];

    const filtered = filterLocationGraph(locations, relations, ['a']);

    expect(idsOf(filtered.locations)).toEqual(['z', 'a', 'm']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r2', 'r1']);
  });

  it('keeps a selected isolated location as the only node', () => {
    const locations = [location('a'), location('b'), location('c')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterLocationGraph(locations, relations, ['c']);

    expect(idsOf(filtered.locations)).toEqual(['c']);
    expect(filtered.relations).toEqual([]);
  });

  it('feeds a layout containing only the kept locations and relations', () => {
    const locations = [location('a'), location('b'), location('c'), location('d')];
    const relations = [
      relation('r1', 'a', 'b'),
      relation('r2', 'b', 'c'),
      relation('r3', 'c', 'd'),
    ];

    const filtered = filterLocationGraph(locations, relations, ['a']);
    const layout = buildLocationGraphLayout(filtered.locations, filtered.relations);

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['a', 'b']);
    expect(layout.edges.map((edge) => edge.id)).toEqual(['r1']);
  });
});