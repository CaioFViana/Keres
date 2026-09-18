/**
 * @jest-environment node
 */
import {
  addLocationMapMarkerConnection,
  appendImagesToMap,
  appendLocationsToMap,
  appendMarkersToMap,
  removeLocationMapPoint,
  setLocationMapRelationText,
} from '../../src/utils/locationMapContent';

const base = { images: [], nodes: [] } as any;

describe('setLocationMapRelationText', () => {
  it('replaces the label for the same pair instead of duplicating it', () => {
    const once = setLocationMapRelationText(base, 'a', 'b', 'First');
    const twice = setLocationMapRelationText(once, 'a', 'b', 'Second');

    expect(twice.relationTexts).toEqual([
      { sourceLocationId: 'a', destinationLocationId: 'b', text: 'Second' },
    ]);
  });

  it('removes the label when cleared', () => {
    const labeled = setLocationMapRelationText(base, 'a', 'b', 'A road');
    const cleared = setLocationMapRelationText(labeled, 'a', 'b', null);

    expect(cleared.relationTexts).toEqual([]);
  });

  it('keeps labels for other pairs', () => {
    const labeled = setLocationMapRelationText(
      setLocationMapRelationText(base, 'a', 'b', 'A road'),
      'a',
      'c',
      'A path',
    );

    expect(setLocationMapRelationText(labeled, 'a', 'b', null).relationTexts).toEqual([
      { sourceLocationId: 'a', destinationLocationId: 'c', text: 'A path' },
    ]);
  });
});

describe('addLocationMapMarkerConnection', () => {
  it('ignores a connection that already exists in either direction', () => {
    const linked = addLocationMapMarkerConnection(base, {
      fromId: 'm1',
      toId: 'm2',
      directed: false,
      label: null,
    });

    expect(
      addLocationMapMarkerConnection(linked, {
        fromId: 'm1',
        toId: 'm2',
        directed: true,
        label: 'Again',
      }),
    ).toBe(linked);
    expect(
      addLocationMapMarkerConnection(linked, {
        fromId: 'm2',
        toId: 'm1',
        directed: false,
        label: null,
      }),
    ).toBe(linked);
  });

  it('assigns an id that avoids every existing point', () => {
    const map = appendMarkersToMap(base, [{ title: 'Gate' }]);
    const linked = addLocationMapMarkerConnection(map, {
      fromId: map.markers[0].id,
      toId: 'elsewhere',
      directed: true,
      label: null,
    });

    expect(linked.markerConnections).toHaveLength(1);
    expect(linked.markerConnections[0].id).not.toBe(map.markers[0].id);
  });
});

describe('removeLocationMapPoint', () => {
  it('removes the node but keeps the rest of the map', () => {
    const map = appendLocationsToMap(base, ['a', 'b']);
    const removed = removeLocationMapPoint(map, map.nodes[0].id);

    expect(removed.nodes.map((node: any) => node.locationId)).toEqual(['b']);
  });

  it('tolerates maps without markers or connections', () => {
    const removed = removeLocationMapPoint(base, 'missing');

    expect(removed.nodes).toEqual([]);
    expect(removed.markers).toBeUndefined();
    expect(removed.markerConnections).toBeUndefined();
  });
});

describe('staggered placement', () => {
  it('wraps the stagger every four entries', () => {
    const map = appendImagesToMap(
      base,
      Array.from({ length: 5 }, (_, index) => ({ galleryId: `g${index}`, width: 10, height: 10 })),
    );

    expect(map.images[0].x).toBe(map.images[4].x);
    expect(map.images[0].y).toBe(map.images[4].y);
    expect(map.images[0].locked).toBe(false);
  });

  it('offsets locations and markers from images', () => {
    const map = appendMarkersToMap(appendLocationsToMap(base, ['a']), [{ title: 'Gate' }]);

    expect(map.nodes[0].x).toBe(80 + 40);
    expect(map.markers[0].x).toBeGreaterThan(map.nodes[0].x);
    expect(map.markers[0]).toMatchObject({ icon: 'pin', note: null, destinationMapId: null });
  });
});
