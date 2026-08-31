import {
  computeAncestorIds,
  computeDescendantIds,
  deriveChildren,
  deriveConnections,
  deriveContains,
  deriveParent,
} from '../../src/utils/locationMapRelations';

const relation = (id: string, relationType: 'contains' | 'connected_to', a: string, b: string) =>
  ({ id, relationType, locationAId: a, locationBId: b }) as never;
const content = {
  nodes: [{ locationId: 'kingdom' }, { locationId: 'city' }, { locationId: 'inn' }],
} as never;

describe('location map relation derivation', () => {
  const relations = [
    relation('kingdom-city', 'contains', 'kingdom', 'city'),
    relation('city-inn', 'contains', 'city', 'inn'),
    relation('inn-road', 'connected_to', 'inn', 'road'),
    relation('city-inn-road', 'connected_to', 'city', 'inn'),
  ];
  const names = new Map([
    ['kingdom', 'Kingdom'],
    ['city', 'City'],
    ['inn', 'Inn'],
  ]);

  it('keeps only map-local connections and containment edges', () => {
    expect(deriveConnections(relations, content)).toEqual([
      { locationAId: 'city', locationBId: 'inn' },
    ]);
    expect(deriveContains(relations, content)).toEqual([
      { parentLocationId: 'kingdom', childLocationId: 'city' },
      { parentLocationId: 'city', childLocationId: 'inn' },
    ]);
  });

  it('derives parent and children labels with resilient id fallbacks', () => {
    expect(deriveParent(relations, 'inn', names)).toEqual({
      relationId: 'city-inn',
      locationId: 'city',
      name: 'City',
    });
    expect(deriveParent(relations, 'kingdom', names)).toBeNull();
    expect(deriveChildren(relations, 'city', names)).toEqual([
      { relationId: 'city-inn', locationId: 'inn', name: 'Inn' },
    ]);
  });

  it('finds ancestors and descendants without looping forever on malformed cycles', () => {
    const cyclic = [...relations, relation('bad-cycle', 'contains', 'inn', 'kingdom')];
    expect(computeAncestorIds(relations, 'inn')).toEqual(new Set(['city', 'kingdom']));
    expect(computeDescendantIds(relations, 'kingdom')).toEqual(new Set(['city', 'inn']));
    expect(computeAncestorIds(cyclic, 'city')).toEqual(new Set(['kingdom', 'inn', 'city']));
  });
});
