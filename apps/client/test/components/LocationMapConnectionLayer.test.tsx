import { render, type RenderResult } from '@testing-library/react-native';
import * as SkiaMock from '@shopify/react-native-skia';
import type { LocationMapContentType } from '@keres/shared';
import { clipSpatialSegment } from '@keres/shared';
import { pointOnCircleBoundary } from '@keres/shared/graphs/locationMapGeometry';
import { LOCATION_MAP_NODE_SIZE } from '@keres/shared/graphs/locationMapLayout';
import { StyleSheet } from 'react-native';
import LocationMapConnectionLayer from '../../src/components/features/location-maps/LocationMapConnectionLayer';

type Root = RenderResult['container'];

const NODES = [
  { id: 'n1', locationId: 'loc-a', x: 100, y: 100, icon: 'flag', color: '#ff0000' },
  { id: 'n2', locationId: 'loc-b', x: 500, y: 300, icon: 'flag', color: '#0000ff' },
  { id: 'n3', locationId: 'loc-c', x: 500, y: 500, icon: 'flag', color: '#00ff00' },
  { id: 'n4', locationId: 'loc-far', x: 5000, y: 5000, icon: 'flag', color: '#00ff00' },
  { id: 'n5', locationId: 'loc-farther', x: 6000, y: 5000, icon: 'flag', color: '#00ff00' },
] as const;
const CONTENT = { images: [], nodes: [...NODES] } as unknown as LocationMapContentType;
const WINDOW = { x: -50, y: -80, width: 1000, height: 800 };
const CAMERA = { value: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] } as never;

const MARGIN = LOCATION_MAP_NODE_SIZE / 2 + 3;

function boundary(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  return pointOnCircleBoundary(from, to, MARGIN);
}

function expectedLine(from: (typeof NODES)[number], to: (typeof NODES)[number]): string {
  const start = boundary(from, to);
  const end = boundary(to, from);
  const segment = clipSpatialSegment(start, end, WINDOW);
  if (!segment) throw new Error('expected a visible segment');
  return `M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`;
}

/** Connection lines only: arrowheads cross the port as filled paths. */
function linePathsOf(root: Root) {
  return root
    .queryAll((node) => node.type === 'SkiaPath' && node.props.style === 'stroke')
    .map((candidate) => candidate.props.path as string)
    .filter((path) => path.includes(' L '));
}

function labelTextsOf(root: Root) {
  return root.queryAll((node) => node.type === 'SkiaText').map((candidate) => candidate.props.text);
}

async function renderLayer(extra: Record<string, unknown> = {}) {
  const view = await render(
    <LocationMapConnectionLayer
      content={CONTENT}
      connections={[{ locationAId: 'loc-a', locationBId: 'loc-b', label: 'trail' }]}
      contains={[{ parentLocationId: 'loc-a', childLocationId: 'loc-c', label: null }]}
      overlays={undefined}
      draft={null}
      rectPreview={null}
      scale={1}
      connectionDrag={null}
      camera={CAMERA}
      renderWindow={WINDOW}
      background="#000"
      primary="#fff"
      {...extra}
    />,
  );
  return view.container;
}

describe('location map connection layer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps the canvas viewport-sized, never world-sized', async () => {
    const root = await renderLayer();
    const [canvas] = root.queryAll((node) => node.type === 'SkiaCanvas');

    expect(StyleSheet.flatten(canvas.props.style)).toMatchObject({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    expect(canvas.props.width).toBeUndefined();
    expect(canvas.props.height).toBeUndefined();
    expect(canvas.props.pointerEvents).toBe('none');
  });

  it('forwards the live camera to the overlay group', async () => {
    const root = await renderLayer();
    const [group] = root.queryAll((node) => node.type === 'SkiaGroup');

    expect(group.props.transform).toBe(CAMERA);
  });

  it('draws connections and contains arrows at their world positions', async () => {
    const root = await renderLayer();

    const drawn = linePathsOf(root);
    // Each relation paints a halo plus the line itself.
    expect(drawn).toHaveLength(4);
    expect(drawn).toContain(expectedLine(NODES[0], NODES[1]));
    expect(drawn).toContain(expectedLine(NODES[0], NODES[2]));

    // The contains arrowhead (halo plus head) sits on the clipped tip.
    const heads = root
      .queryAll((node) => node.type === 'SkiaPath')
      .filter((path) => path.props.style !== 'stroke');
    expect(heads).toHaveLength(2);
    const tip = boundary(NODES[2], NODES[0]);
    for (const head of heads) {
      const [tipX, tipY] = (head.props.path as string)
        .slice(2)
        .split(' ')[0]
        .split(',')
        .map(Number);
      expect(tipX).toBeCloseTo(tip.x, 8);
      expect(tipY).toBeCloseTo(tip.y, 8);
    }
    // The contains line keeps its historical dash rhythm.
    const dashes = root.queryAll((node) => node.type === 'SkiaDashPathEffect');
    expect(dashes).toHaveLength(1);
    expect(dashes[0].props.intervals).toEqual([6, 4]);
  });

  it('draws directed marker connections with arrowheads and labels', async () => {
    const root = await renderLayer({
      content: {
        ...CONTENT,
        markers: [{ id: 'm1', x: 300, y: 200, color: '#ff00ff' }],
        markerConnections: [{ id: 'mc1', fromId: 'n1', toId: 'm1', directed: true, label: 'mk' }],
      },
      connections: [],
      contains: [],
    });

    const drawn = linePathsOf(root);
    expect(drawn).toHaveLength(2);
    const heads = root
      .queryAll((node) => node.type === 'SkiaPath')
      .filter((path) => path.props.style !== 'stroke');
    expect(heads).toHaveLength(2);
    expect(labelTextsOf(root)).toEqual(['mk', 'mk']);
  });

  it('renders the visible label and clips a connection that leaves the window', async () => {
    const root = await renderLayer({
      connections: [
        { locationAId: 'loc-a', locationBId: 'loc-b', label: 'trail' },
        { locationAId: 'loc-a', locationBId: 'loc-far', label: 'outbound' },
      ],
    });

    const labels = labelTextsOf(root);
    expect(labels).toContain('trail');
    // The outbound midpoint leaves the window with the far endpoint, so its label is dropped.
    expect(labels).not.toContain('outbound');

    const drawn = linePathsOf(root);
    expect(drawn).toContain(expectedLine(NODES[0], NODES[3]));
  });

  it('culls a connection that never reaches the render window', async () => {
    const root = await renderLayer({
      connections: [{ locationAId: 'loc-far', locationBId: 'loc-farther', label: 'far' }],
      contains: [],
    });

    expect(linePathsOf(root)).toHaveLength(0);
    expect(labelTextsOf(root)).not.toContain('far');
  });

  it('draws edges without labels when the system font is unavailable', async () => {
    // Web: `matchFamilyStyle` is unimplemented and throws; the layer must survive with
    // edges only, never a black screen.
    jest.spyOn(SkiaMock, 'matchFont').mockImplementation(() => {
      throw new Error('Not implemented on React Native Web');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const root = await renderLayer();

    expect(labelTextsOf(root)).toHaveLength(0);
    expect(linePathsOf(root)).toContain(expectedLine(NODES[0], NODES[1]));
  });
});
