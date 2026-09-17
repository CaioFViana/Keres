import { act, render, type RenderResult } from '@testing-library/react-native';
import type { BoardContentType } from '@keres/shared';
import { spatialNativeSurface } from '@keres/shared';
import React, { createRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import BoardCanvas, {
  type BoardCanvasHandle,
} from '../../src/components/features/boards/BoardCanvas';
import { boardEdgeGeometry } from '../../src/utils/boardEdges';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
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
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({ useResolvedMediaUri: () => null }));

type Root = RenderResult['container'];

const VIEWPORT = { width: 400, height: 300 };

const NODES = [
  { id: 'a', kind: 'note', x: 0, y: 0, width: 200, height: 120, title: 'A', body: null },
  { id: 'b', kind: 'note', x: 600, y: 400, width: 200, height: 120, title: 'B', body: null },
] as const;
const EDGE = { id: 'e1', from: 'a', to: 'b', directed: true, label: null };
const CONTENT = { nodes: [...NODES], edges: [EDGE] } as unknown as BoardContentType;

const noop = () => {};

/** The shared `View` prototype, where `measureInWindow` is mocked per test. */
let viewPrototype: any = null;

beforeAll(async () => {
  let captured: unknown = null;
  const probe = await render(
    <View
      ref={(instance) => {
        captured = instance;
      }}
    />,
  );
  viewPrototype = Object.getPrototypeOf(captured);
  await probe.unmount();
});

beforeEach(() => {
  (jest.spyOn(viewPrototype, 'measureInWindow') as jest.Mock).mockImplementation(
    (callback: (...args: number[]) => void) => callback(0, 0, VIEWPORT.width, VIEWPORT.height),
  );
});

afterEach(() => jest.restoreAllMocks());

async function renderBoard() {
  const ref = createRef<BoardCanvasHandle>();
  const create = jest.spyOn(PanResponder, 'create');
  const view = await render(
    <BoardCanvas
      ref={ref}
      content={CONTENT}
      titles={{
        a: { title: 'A', typeLabel: 'note' },
        b: { title: 'B', typeLabel: 'note' },
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
  // The canvas owns the first responder: the parent hook runs before any node renders.
  const config = create.mock.calls[0]![0] as any;
  return { ref, config, root: view.container };
}

async function fireLayout(root: Root) {
  const containers = root.queryAll((node) => typeof node.props.onLayout === 'function');
  expect(containers.length).toBeGreaterThan(0);
  await act(async () => {
    containers[0].props.onLayout();
  });
}

function overlayOf(root: Root) {
  const [svg] = root.queryAll((node) => node.type === 'RNSVGSvgView');
  const style = StyleSheet.flatten(svg.props.style);
  return {
    left: style.left as number,
    top: style.top as number,
    width: svg.props.width as number,
    height: svg.props.height as number,
  };
}

/** The live camera, read off the single host view that carries the transform. */
function transformOf(root: Root) {
  const planes = root.queryAll((node) => {
    if (node.type !== 'View') return false;
    const style = StyleSheet.flatten(node.props.style);
    return Array.isArray(style?.transform);
  });
  expect(planes).toHaveLength(1);
  const [translateX, translateY, scale] = StyleSheet.flatten(planes[0].props.style).transform;
  // Host props carry resolved numbers; accept an `Animated.Value` too, in case that changes.
  const valueOf = (entry: Record<string, unknown>) => {
    const value = Object.values(entry)[0] as any;
    return (
      typeof value === 'object' && value !== null && '_value' in value ? value._value : value
    ) as number;
  };
  return { x: valueOf(translateX), y: valueOf(translateY), scale: valueOf(scale) };
}

/** Edge lines only: an arrowhead's path never contains a line-to. */
function edgeLinesOf(root: Root) {
  return root
    .queryAll((node) => node.type === 'RNSVGPath')
    .map((candidate) => candidate.props.d as string)
    .filter((d) => d.includes(' L '));
}

function drawnPointsOf(root: Root) {
  return root
    .queryAll((node) => node.type === 'RNSVGPath')
    .flatMap((candidate) => {
      const numbers = (candidate.props.d as string).match(/-?\d+\.?\d*(?:e-?\d+)?/g) ?? [];
      const points: { x: number; y: number }[] = [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({ x: Number(numbers[index]), y: Number(numbers[index + 1]) });
      }
      return points;
    });
}

describe('board edges overlay', () => {
  it('fits a drawing larger than the viewport at a scale below one', async () => {
    const { root } = await renderBoard();
    await fireLayout(root);

    // The regression only bites below scale 1: the overlay used to be sized in screen pixels,
    // which covers a shrinking fraction of the world as the camera zooms out.
    expect(transformOf(root).scale).toBeLessThan(1);
  });

  it('draws the edge in world coordinates, sized so the native bitmap covers the render window', async () => {
    const { root } = await renderBoard();
    await fireLayout(root);

    const geometry = boardEdgeGeometry(CONTENT.nodes[0], CONTENT.nodes[1], EDGE as never);
    expect(edgeLinesOf(root)).toEqual([
      `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y}`,
    ]);

    // World-sized overlay: the bitmap it rasterizes to stays the viewport-sized surface.
    const overlay = overlayOf(root);
    const { scale } = transformOf(root);
    const surface = spatialNativeSurface(VIEWPORT.width, VIEWPORT.height);
    expect(overlay.width * scale).toBeCloseTo(surface.width, 3);
    expect(overlay.height * scale).toBeCloseTo(surface.height, 3);

    // Every drawn point lands inside the overlay: outside it the native SVG view clips, which
    // is exactly how the arrows used to disappear.
    const drawn = drawnPointsOf(root);
    expect(drawn.length).toBeGreaterThan(0);
    for (const point of drawn) {
      expect(point.x).toBeGreaterThanOrEqual(overlay.left);
      expect(point.x).toBeLessThanOrEqual(overlay.left + overlay.width);
      expect(point.y).toBeGreaterThanOrEqual(overlay.top);
      expect(point.y).toBeLessThanOrEqual(overlay.top + overlay.height);
    }
  });

  it('keeps the edge world-stable while zoom re-covers the camera', async () => {
    const { ref, root } = await renderBoard();
    await fireLayout(root);
    const [before] = edgeLinesOf(root);
    const scaleBefore = transformOf(root).scale;

    await act(async () => {
      ref.current!.zoomBy(2);
    });

    // The camera moved (scale doubled) but the edge is fully visible, so its world path is
    // untouched: pan/zoom only ever rewrite the container transform.
    expect(transformOf(root).scale).toBeCloseTo(scaleBefore * 2, 4);
    expect(edgeLinesOf(root)).toEqual([before]);
    const overlay = overlayOf(root);
    const surface = spatialNativeSurface(VIEWPORT.width, VIEWPORT.height);
    expect(overlay.width * scaleBefore * 2).toBeCloseTo(surface.width, 3);
    expect(overlay.height * scaleBefore * 2).toBeCloseTo(surface.height, 3);
  });

  it('moves the camera without touching the drawing on a small pan', async () => {
    const { ref, config, root } = await renderBoard();
    await fireLayout(root);
    const centerBefore = ref.current!.viewportWorldCenter();
    const [pathBefore] = edgeLinesOf(root);
    const overlayBefore = overlayOf(root);

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -60, dy: 0 });
    });

    // Inside the hysteresis margin no overlay re-sync fires: the drawing must not teleport.
    const centerAfter = ref.current!.viewportWorldCenter();
    expect(centerAfter.x).toBeGreaterThan(centerBefore.x);
    expect(edgeLinesOf(root)).toEqual([pathBefore]);
    expect(overlayOf(root)).toEqual(overlayBefore);
  });

  it('culls the edge once a pan carries it out of the render window', async () => {
    const { config, root } = await renderBoard();
    await fireLayout(root);
    expect(edgeLinesOf(root)).toHaveLength(1);
    // A pan never changes the scale; read it while the plane is easily found.
    const { scale } = transformOf(root);

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -2000, dy: 0 });
    });

    // The overlay re-covered the new camera and the edge, now fully outside, is culled
    // instead of drawn at a stale position.
    expect(edgeLinesOf(root)).toHaveLength(0);
    const overlay = overlayOf(root);
    const surface = spatialNativeSurface(VIEWPORT.width, VIEWPORT.height);
    expect(overlay.width * scale).toBeCloseTo(surface.width, 3);
    expect(overlay.height * scale).toBeCloseTo(surface.height, 3);
  });
});
