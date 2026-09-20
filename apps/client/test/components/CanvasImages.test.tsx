import { act, render, type RenderResult } from '@testing-library/react-native';
import type { BoardContentType, LocationMapImageType } from '@keres/shared';
import BoardCanvas from '../../src/components/features/boards/BoardCanvas';
import LocationMapImageView from '../../src/components/features/location-maps/LocationMapImageView';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      border: '#444',
      error: '#c33',
      onPrimary: '#fff',
      primary: '#85f',
      primaryContainer: '#223',
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
    },
  }),
}));
jest.mock('expo-image', () => ({ Image: 'ExpoImageStub' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({ useResolvedMediaUri: () => null }));

type Root = RenderResult['container'];

const noop = () => {};

async function fireLayout(root: Root) {
  const containers = root.queryAll((node) => typeof node.props.onLayout === 'function');
  expect(containers.length).toBeGreaterThan(0);
  await act(async () => {
    containers[0].props.onLayout();
  });
}

/** Every canvas image must stay hit-transparent: the owning view claims the gesture. */
function expectImagesHitTransparent(root: Root) {
  const images = root.queryAll((node) => node.type === 'ExpoImageStub');
  expect(images).toHaveLength(1);
  expect(images[0].props.pointerEvents).toBe('none');
}

describe('canvas images', () => {
  it('keeps the board gallery image hit-transparent so the pin owns the gesture', async () => {
    const content = {
      nodes: [{ id: 'g', kind: 'entity', entityType: 'Gallery', entityId: 'gal-1', x: 0, y: 0 }],
      edges: [],
    } as unknown as BoardContentType;
    const view = await render(
      <BoardCanvas
        content={content}
        titles={{ g: { title: 'G', typeLabel: 'Gallery' } }}
        galleryMediaById={{
          'gal-1': {
            mediaType: 'image',
            mimeType: 'image/png',
            localPath: 'Closed Beta/gal-1.png',
            thumbnailPath: null,
          },
        }}
        selectedNodeId={null}
        layoutEditing={false}
        connectionMode={false}
        onSelectNode={noop}
        onMoveNode={noop}
        onResizeNode={noop}
        onOpenNodeDetails={noop}
        onBringNodeToFront={noop}
        onSendNodeToBack={noop}
        onConnectNodes={noop}
      />,
    );
    await fireLayout(view.container);
    expectImagesHitTransparent(view.container);
  });

  it('keeps the map image base hit-transparent so the image view owns the gesture', async () => {
    const image = {
      id: 'img-1',
      galleryId: 'gal-1',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      locked: false,
    } as LocationMapImageType;
    const view = await render(
      <LocationMapImageView
        image={image}
        uri="https://example.com/img-1.png"
        selected={false}
        layoutEditing={false}
        scale={1}
        locked={false}
        onSelect={noop}
        onMove={noop}
        onResize={noop}
        onDragStart={noop}
        onDragEnd={noop}
        onBringToFront={noop}
        onSendToBack={noop}
        onToggleLock={noop}
        onRemove={noop}
      />,
    );
    expectImagesHitTransparent(view.container);
  });
});
