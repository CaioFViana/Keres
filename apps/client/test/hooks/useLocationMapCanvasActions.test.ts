const mockAppendImages = jest.fn();
const mockAppendLocations = jest.fn();
const mockAppendMarkers = jest.fn();
const mockImageSize = jest.fn();
const mockCreateMap = jest.fn();

jest.mock('../../src/utils/locationMapContent', () => ({
  __esModule: true,
  appendImagesToMap: (...args: unknown[]) => mockAppendImages(...args),
  appendLocationsToMap: (...args: unknown[]) => mockAppendLocations(...args),
  appendMarkersToMap: (...args: unknown[]) => mockAppendMarkers(...args),
}));
jest.mock('../../src/utils/locationMapMedia', () => ({
  __esModule: true,
  imageSizeOf: (...args: unknown[]) => mockImageSize(...args),
}));
jest.mock('../../src/services/storymanagement/LocationMapService', () => ({
  __esModule: true,
  createLocationMapService: jest.fn(() => ({ createMap: mockCreateMap })),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useLocationMapCanvasActions } from '../../src/hooks/useLocationMapCanvasActions';

let currentContent: any;
const setContent = jest.fn((update) => {
  currentContent = typeof update === 'function' ? update(currentContent) : update;
});
const setters = {
  setSelectedImageId: jest.fn(),
  setSelectedNodeId: jest.fn(),
  setSelectedMarkerId: jest.fn(),
  setOpenedNodeId: jest.fn(),
  setOpenedMarkerId: jest.fn(),
  setMaps: jest.fn(),
};

function options(overrides = {}) {
  currentContent = {
    images: [
      { id: 'image-1', galleryId: 'used', x: 1, y: 2, width: 10, height: 20, locked: false },
    ],
    nodes: [{ id: 'node-1', locationId: 'a', x: 1, y: 2 }],
    markers: [{ id: 'marker-1', title: 'M', x: 1, y: 2, destinationMapId: 'map-2' }],
  };
  return {
    content: currentContent,
    setContent,
    placementOrigin: () => ({ x: 5, y: 6 }),
    galleries: [
      {
        id: 'available',
        mediaType: 'image',
        localPath: '/image.png',
        title: 'Photo',
        fileName: 'p.png',
      },
      { id: 'used', mediaType: 'image', localPath: '/used.png', title: 'Used', fileName: 'u.png' },
      { id: 'text', mediaType: 'text', localPath: '/text', title: 'Text', fileName: 't' },
    ],
    locations: [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ],
    maps: [
      { id: 'map-1', name: 'Current' },
      { id: 'map-2', name: 'Destination' },
    ],
    mapId: 'map-1',
    galleryMediaById: {
      available: {
        mediaType: 'image',
        mimeType: 'image/png',
        localPath: '/image.png',
        thumbnailPath: null,
      },
    },
    layoutEditing: false,
    navigation: { navigate: jest.fn() },
    t: (key: string) => key,
    ...setters,
    db: {} as never,
    storyId: 'story',
    userId: 'user',
    showNotification: jest.fn(),
    ...overrides,
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockImageSize.mockResolvedValue({ width: 800, height: 400 });
  mockAppendImages.mockImplementation((content, images) => ({
    ...content,
    images: [...content.images, ...images],
  }));
  mockAppendLocations.mockImplementation((content, ids) => ({
    ...content,
    nodes: [...content.nodes, ...ids.map((locationId: string) => ({ id: locationId, locationId }))],
  }));
  mockAppendMarkers.mockImplementation((content, markers) => ({
    ...content,
    markers: [...(content.markers ?? []), ...markers],
  }));
  mockCreateMap.mockResolvedValue({ id: 'created-map', name: 'New' });
});

describe('useLocationMapCanvasActions', () => {
  it('derives available gallery, location, and destination options', async () => {
    const view = await renderHook(() => useLocationMapCanvasActions(options()));
    expect(view.result.current.imageOptions).toEqual([{ label: 'Photo', value: 'available' }]);
    expect(view.result.current.locationOptions).toEqual([
      expect.objectContaining({ label: 'Beta', value: 'b' }),
    ]);
    expect(view.result.current.destinationOptions).toEqual([
      { label: 'Destination', value: 'map-2' },
    ]);
    expect(view.result.current.destinationName('map-2')).toBe('Destination');
    expect(view.result.current.destinationName('missing')).toBeNull();
  });

  it('adds, edits, moves, layers and selects canvas content', async () => {
    const view = await renderHook(() => useLocationMapCanvasActions(options()));
    await act(async () => view.result.current.addImages(['available']));
    expect(mockAppendImages).toHaveBeenCalledWith(
      expect.anything(),
      [{ galleryId: 'available', width: 320, height: 160 }],
      { x: 5, y: 6 },
    );
    await act(async () => {
      view.result.current.addLocations(['b']);
      view.result.current.addMarker();
      view.result.current.handleResizeImageDirect('image-1', -5, 99999);
      view.result.current.handleToggleImageLock('image-1');
      view.result.current.handleMoveImage('image-1', 12, 13);
      view.result.current.handleMoveNode('node-1', 14, 15);
      view.result.current.handleMoveMarker('marker-1', 16, 17);
      view.result.current.moveImageLayer('image-1', 'front');
      view.result.current.moveNodeLayer('node-1', 'back');
      view.result.current.moveMarkerLayer('marker-1', 'front');
      view.result.current.handleSelectImage('image-1');
      view.result.current.handleSelectNode('node-1');
      view.result.current.handleSelectMarker('marker-1');
    });
    expect(mockAppendLocations).toHaveBeenCalled();
    expect(mockAppendMarkers).toHaveBeenCalled();
    expect(setters.setSelectedImageId).toHaveBeenCalledWith('image-1');
    expect(setters.setOpenedNodeId).toHaveBeenCalledWith('node-1');
    expect(setters.setOpenedMarkerId).toHaveBeenCalledWith('marker-1');
  });

  it('opens destinations or selects missing ones, creates destination maps, and reports errors', async () => {
    const input = options();
    const view = await renderHook(() => useLocationMapCanvasActions(input));
    await act(async () => {
      view.result.current.openDestination('map-2');
      view.result.current.handleOpenMarkerDestination('marker-1');
      view.result.current.handleOpenNodeDestination('node-1');
    });
    expect(input.navigation.navigate).toHaveBeenCalledWith('LocationMap', { mapId: 'map-2' });
    expect(setters.setSelectedNodeId).toHaveBeenCalledWith('node-1');
    const setDestination = jest.fn();
    await act(async () =>
      view.result.current.createDestination({ locationId: 'b', title: 'Beta' }, setDestination),
    );
    expect(mockCreateMap).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ storyId: 'story', name: 'Beta — location_map_destination' }),
    );
    expect(setDestination).toHaveBeenCalledWith('created-map');

    mockCreateMap.mockRejectedValueOnce(new Error('offline'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await act(async () => view.result.current.createDestination({ title: 'Lost' }, setDestination));
    expect(input.showNotification).toHaveBeenCalledWith('location_map_save_failed', 'error');
  });
});
