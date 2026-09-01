/**
 * @jest-environment node
 */
import {
  appendImagesToMap,
  appendLocationsToMap,
  appendMarkersToMap,
} from '../../src/utils/locationMapContent';
import { deriveConnections, deriveContains } from '../../src/utils/locationMapRelations';

const content = { images: [], nodes: [] };

it('appends image bases with staggered positions and unique ids', () => {
  const next = appendImagesToMap(content, [
    { galleryId: 'g1', width: 320, height: 240 },
    { galleryId: 'g2', width: 100, height: 100 },
  ]);

  expect(next.images).toHaveLength(2);
  expect(next.images[0].galleryId).toBe('g1');
  expect(next.images[0].width).toBe(320);
  expect(next.images[0].x).not.toBe(next.images[1].x);
  expect(next.images[0].id).not.toBe(next.images[1].id);
});

it('appends location points with the default icon and colour', () => {
  const next = appendLocationsToMap(content, ['location-1']);

  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0].locationId).toBe('location-1');
  expect(next.nodes[0].icon).toBe('map');
  expect(next.nodes[0].color).toBe('#8BC34A');
});

it('appends free markers without creating a location entity', () => {
  const next = appendMarkersToMap(content, [{ title: 'Hidden key', note: 'Behind the statue' }]);
  expect(next.nodes).toHaveLength(0);
  expect(next.markers?.[0]).toMatchObject({
    title: 'Hidden key',
    note: 'Behind the statue',
    destinationMapId: null,
  });
});

const relationBase = {
  storyId: 'story-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

const relations = [
  {
    id: 'r1',
    locationAId: 'a',
    locationBId: 'b',
    relationType: 'connected_to' as const,
    ...relationBase,
  },
  {
    id: 'r2',
    locationAId: 'a',
    locationBId: 'c',
    relationType: 'contains' as const,
    ...relationBase,
  },
  {
    id: 'r3',
    locationAId: 'a',
    locationBId: 'd',
    relationType: 'connected_to' as const,
    ...relationBase,
  },
];

it('derives only the relations between locations on the map', () => {
  const map = {
    images: [],
    nodes: [
      { id: 'n1', locationId: 'a', x: 0, y: 0, icon: 'pin', color: '#8BC34A' },
      { id: 'n2', locationId: 'b', x: 0, y: 0, icon: 'pin', color: '#8BC34A' },
    ],
  };

  expect(deriveConnections(relations, map)).toEqual([{ locationAId: 'a', locationBId: 'b' }]);
  expect(deriveContains(relations, map)).toEqual([]);
});

it('includes contains relations when both ends are on the map', () => {
  const map = {
    images: [],
    nodes: [
      { id: 'n1', locationId: 'a', x: 0, y: 0, icon: 'pin', color: '#8BC34A' },
      { id: 'n2', locationId: 'c', x: 0, y: 0, icon: 'pin', color: '#8BC34A' },
    ],
  };

  expect(deriveContains(relations, map)).toEqual([{ parentLocationId: 'a', childLocationId: 'c' }]);
});
