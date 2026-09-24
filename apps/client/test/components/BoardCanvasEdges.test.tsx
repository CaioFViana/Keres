import { act, render, type RenderResult } from '@testing-library/react-native';
import * as SkiaMock from '@shopify/react-native-skia';
import type { BoardContentType } from '@keres/shared';
import React, { createRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import BoardCanvas, {
  type BoardCanvasHandle,
} from '../../src/components/features/boards/BoardCanvas';
import SkiaEdgeCanvas from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
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
const overlayCallbacks = {
  onDrawTap: noop,
  onStampPlace: noop,
  onDeselectOverlay: noop,
  onOpenOverlaySheet: noop,
  onMoveOverlayLayer: noop,
  onToggleLock: noop,
  onDrawRect: noop,
  onSelectOverlay: noop,
  onCommitMove: noop,
  onCommitVertex: noop,
  onCommitRect: noop,
};

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

async function renderBoard(content: BoardContentType = CONTENT) {
  const ref = createRef<BoardCanvasHandle>();
  const create = jest.spyOn(PanResponder, 'create');
  const view = await render(
    <BoardCanvas
      ref={ref}
      content={content}
      titles={{
        a: { title: 'A', typeLabel: 'note' },
        b: { title: 'B', typeLabel: 'note' },
      }}
      selectedNodeId={null}
      layoutEditing={false}
      connectionMode={false}
      overlayEditing={false}
      onSelectNode={noop}
      onMoveNode={noop}
      onResizeNode={noop}
      onOpenNodeDetails={noop}
      onBringNodeToFront={noop}
      onSendNodeToBack={noop}
      onConnectNodes={noop}
      interactionMode={null}
      draft={null}
      selectedOverlayId={null}
      overlayCallbacks={overlayCallbacks}
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

function canvasOf(root: Root) {
  const canvases = root.queryAll((node) => node.type === 'SkiaCanvas');
  expect(canvases).toHaveLength(1);
  return canvases[0];
}

function groupOf(root: Root) {
  const groups = root.queryAll((node) => node.type === 'SkiaGroup');
  expect(groups).toHaveLength(1);
  return groups[0];
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

function expectMirror(root: Root) {
  const camera = transformOf(root);
  expect(groupOf(root).props.transform.value).toEqual([
    { translateX: camera.x },
    { translateY: camera.y },
    { scale: camera.scale },
  ]);
}

/** Edge lines only: arrowheads cross the port as filled paths. */
function edgeLinesOf(root: Root) {
  return root
    .queryAll((node) => node.type === 'SkiaPath' && node.props.style === 'stroke')
    .map((candidate) => candidate.props.path as string)
    .filter((path) => path.includes(' L '));
}

describe('board edges overlay', () => {
  it('fits a drawing larger than the viewport at a scale below one', async () => {
    const { root } = await renderBoard();
    await fireLayout(root);

    // The crash scenario is a fitted drawing at scale < 1: the old world-sized overlay asked
    // for surface/scale pixels per side here.
    expect(transformOf(root).scale).toBeLessThan(1);
  });

  it('draws the edge in world coordinates on a viewport-bounded canvas', async () => {
    const { root } = await renderBoard();
    await fireLayout(root);

    const geometry = boardEdgeGeometry(CONTENT.nodes[0], CONTENT.nodes[1], EDGE as never);
    expect(edgeLinesOf(root)).toEqual([
      `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y}`,
    ]);

    // Absolute-fill of the frame: bounded by the viewport on every platform, with no width
    // or height the render window could inflate.
    const canvas = canvasOf(root);
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
    expectMirror(root);
  });

  it('paints the overlay before the plane, outside the animated transform', async () => {
    const { root } = await renderBoard();
    await fireLayout(root);

    const frame = root.queryAll((node) => typeof node.props.onLayout === 'function')[0];
    const [first, second] = React.Children.toArray(frame.props.children);
    // The overlay slot holds the contained Skia canvas: the boundary renders its child
    // inline, so order and placement are unchanged.
    expect((first as any)?.type).toBe(SkiaOverlayErrorBoundary);
    expect((first as any)?.props?.children?.type).toBe(SkiaEdgeCanvas);
    expect(second).toBeTruthy();
    const planeKids = React.Children.toArray((second as any)?.props?.children);
    expect(planeKids.some((kid) => (kid as any)?.type === SkiaEdgeCanvas)).toBe(false);
  });

  it('fills the arrowhead and halos the label', async () => {
    const labeled = {
      nodes: [...NODES],
      edges: [{ ...EDGE, label: 'hi' }],
    } as unknown as BoardContentType;
    const { root } = await renderBoard(labeled);
    await fireLayout(root);

    // The arrowhead is a filled path converted from the same points (closed with Z).
    const heads = root
      .queryAll((node) => node.type === 'SkiaPath')
      .filter((path) => path.props.style !== 'stroke');
    expect(heads).toHaveLength(1);
    expect(heads[0].props.path).toMatch(/^M .* L .* Z$/);
    expect(heads[0].props.color).toBe('#fff');

    // Halo stroke under fill, centered on the label point by measured width.
    const geometry = boardEdgeGeometry(
      labeled.nodes[0],
      labeled.nodes[1],
      labeled.edges[0] as never,
    );
    const texts = root.queryAll((node) => node.type === 'SkiaText');
    expect(texts).toHaveLength(2);
    const [halo, fill] = texts;
    expect(halo.props).toMatchObject({
      text: 'hi',
      x: geometry.labelX - (2 * 6) / 2,
      y: geometry.labelY,
      color: '#000',
      style: 'stroke',
      strokeWidth: 4,
    });
    expect(fill.props).toMatchObject({
      text: 'hi',
      x: geometry.labelX - (2 * 6) / 2,
      y: geometry.labelY,
      color: '#fff',
    });
  });

  it('draws edges without labels when the system font is unavailable', async () => {
    // Web: `matchFamilyStyle` is unimplemented and throws; the canvas must survive with
    // edges only, never a black screen.
    jest.spyOn(SkiaMock, 'matchFont').mockImplementation(() => {
      throw new Error('Not implemented on React Native Web');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const labeled = {
      nodes: [...NODES],
      edges: [{ ...EDGE, label: 'hi' }],
    } as unknown as BoardContentType;
    const { root } = await renderBoard(labeled);
    await fireLayout(root);

    expect(root.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
    expect(edgeLinesOf(root)).toHaveLength(1);
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
    // untouched: pan/zoom only ever rewrite the container transform and its mirror.
    expect(transformOf(root).scale).toBeCloseTo(scaleBefore * 2, 4);
    expect(edgeLinesOf(root)).toEqual([before]);
    expectMirror(root);
  });

  it('moves the camera without touching the drawing on a small pan', async () => {
    const { ref, config, root } = await renderBoard();
    await fireLayout(root);
    const centerBefore = ref.current!.viewportWorldCenter();
    const [pathBefore] = edgeLinesOf(root);

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -60, dy: 0 });
    });

    // Inside the hysteresis margin no re-sync fires, so the world path is untouched; the
    // overlay tracks the move through the live camera mirror instead of a re-render.
    const centerAfter = ref.current!.viewportWorldCenter();
    expect(centerAfter.x).toBeGreaterThan(centerBefore.x);
    expect(edgeLinesOf(root)).toEqual([pathBefore]);
    expectMirror(root);
  });

  it('culls the edge once a pan carries it out of the render window', async () => {
    const { config, root } = await renderBoard();
    await fireLayout(root);
    expect(edgeLinesOf(root)).toHaveLength(1);

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -2000, dy: 0 });
    });

    // The overlay re-covered the new camera and the edge, now fully outside, is culled
    // instead of drawn at a stale position.
    expect(edgeLinesOf(root)).toHaveLength(0);
    expectMirror(root);
  });
});
