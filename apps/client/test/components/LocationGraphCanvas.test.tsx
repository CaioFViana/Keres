import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { LocationGraphLayout } from '@keres/shared/graphs/locationGraphLayout';
import React, { createRef } from 'react';
import { StyleSheet, View } from 'react-native';
import LocationGraphCanvas, {
  type LocationGraphCanvasHandle,
} from '../../src/components/features/graphs/LocationGraph/LocationGraphCanvas';
import SkiaEdgeCanvas from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#85f',
      primaryContainer: '#223',
      surface: '#111',
      onPrimary: '#fff',
      border: '#444',
      text: '#fff',
      textSecondary: '#aaa',
    },
  }),
}));

type Root = RenderResult['container'];

const VIEWPORT = { width: 400, height: 300 };

const LAYOUT = {
  nodes: [
    {
      id: 'a',
      location: { id: 'a' },
      labelLines: ['A'],
      depth: 0,
      isIsolated: false,
      x: 0,
      y: 0,
      width: 200,
      height: 120,
    },
    {
      id: 'b',
      location: { id: 'b' },
      labelLines: ['B'],
      depth: 1,
      isIsolated: false,
      x: 600,
      y: 400,
      width: 200,
      height: 120,
    },
  ],
  edges: [
    {
      id: 'e1',
      relation: {},
      relationType: 'contains',
      sourceId: 'a',
      targetId: 'b',
      path: 'M 200 60 L 600 460',
    },
    {
      id: 'e2',
      relation: {},
      relationType: 'connected_to',
      sourceId: 'b',
      targetId: 'a',
      path: 'M 600 460 L 200 60',
    },
  ],
  width: 800,
  height: 520,
  treeCount: 1,
  isolatedCount: 0,
} as unknown as LocationGraphLayout;

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

async function renderGraph(props: Partial<React.ComponentProps<typeof LocationGraphCanvas>> = {}) {
  const ref = createRef<LocationGraphCanvasHandle>();
  const view = await render(
    <LocationGraphCanvas
      ref={ref}
      layout={LAYOUT}
      selectedNodeId={null}
      nodeAccessibilityLabel={(node) => `place ${node.id}`}
      onSelectNode={noop}
      {...props}
    />,
  );
  return { ref, root: view.container, view };
}

async function fireLayout(root: Root) {
  const containers = root.queryAll((node) => typeof node.props.onLayout === 'function');
  expect(containers.length).toBeGreaterThan(0);
  await act(async () => {
    containers[0].props.onLayout();
  });
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
  const valueOf = (entry: Record<string, unknown>) => {
    const value = Object.values(entry)[0] as any;
    return (
      typeof value === 'object' && value !== null && '_value' in value ? value._value : value
    ) as number;
  };
  return { x: valueOf(translateX), y: valueOf(translateY), scale: valueOf(scale) };
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

describe('location graph skia overlay', () => {
  it('keeps the canvas viewport-sized below scale one, never world-sized', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    // The crash scenario is a fitted drawing at scale < 1: the old world-sized Svg asked for
    // surface/scale pixels per side here.
    expect(transformOf(root).scale).toBeLessThan(1);

    const canvas = canvasOf(root);
    // Absolute-fill of the frame: bounded by the viewport on every platform, with no width or
    // height the render window could inflate.
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

  it('paints the overlay before the plane, outside the animated transform', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    const frame = root.queryAll((node) => typeof node.props.onLayout === 'function')[0];
    // The frame's children, in order: the contained Skia overlay element, then the
    // animated plane. The boundary renders its child inline, so order is unchanged.
    const [first, second] = React.Children.toArray(frame.props.children);
    expect((first as any)?.type).toBe(SkiaOverlayErrorBoundary);
    expect((first as any)?.props?.children?.type).toBe(SkiaEdgeCanvas);
    expect(second).toBeTruthy();
    // The plane's own children are nodes only: no Skia subtree under the animated transform,
    // so the camera the Group carries can never double-apply.
    const planeKids = React.Children.toArray((second as any)?.props?.children);
    expect(planeKids.some((kid) => (kid as any)?.type === SkiaEdgeCanvas)).toBe(false);
  });

  it('draws every edge in world coordinates with its relation style', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    const paths = root.queryAll((node) => node.type === 'SkiaPath');
    expect(paths.map((path) => path.props.path).sort()).toEqual([
      'M 200 60 L 600 460',
      'M 600 460 L 200 60',
    ]);
    const [contains, connected] = paths.sort((a, b) =>
      String(a.props.path).localeCompare(String(b.props.path)),
    );
    expect(contains.props).toMatchObject({
      style: 'stroke',
      color: '#85f',
      strokeWidth: 1.8,
      opacity: 0.9,
    });
    expect(connected.props).toMatchObject({
      style: 'stroke',
      color: '#aaa',
      strokeWidth: 1.4,
      opacity: 0.65,
    });
    // As on the location map, `contains` is the dashed line and `connected_to` the solid one.
    const dashes = root.queryAll((node) => node.type === 'SkiaDashPathEffect');
    expect(dashes).toHaveLength(1);
    expect(dashes[0].props.intervals).toEqual([6, 4]);
    const dashKids = (path: any) => React.Children.toArray(path.props.children).filter(Boolean);
    expect(dashKids(connected)).toHaveLength(0);
    const containsDashes = dashKids(contains);
    expect(containsDashes).toHaveLength(1);
    expect((containsDashes[0] as any).props.intervals).toEqual([6, 4]);
  });

  it('mirrors the live camera into the overlay group on every publish', async () => {
    const { ref, root } = await renderGraph();
    await fireLayout(root);

    const expectMirror = () => {
      const camera = transformOf(root);
      expect(groupOf(root).props.transform.value).toEqual([
        { translateX: camera.x },
        { translateY: camera.y },
        { scale: camera.scale },
      ]);
    };
    expectMirror();

    await act(async () => {
      ref.current!.zoomBy(2);
    });
    expectMirror();
  });
});

const pathOf = (root: Root, path: string) =>
  root.queryAll((node) => node.type === 'SkiaPath' && node.props.path === path)[0];

describe('location graph with a node in focus', () => {
  it('draws the lines that touch the focus stronger, and the others barely there', async () => {
    const three = {
      ...LAYOUT,
      nodes: [...LAYOUT.nodes, { ...LAYOUT.nodes[1], id: 'c', x: 900 }],
      edges: [
        ...LAYOUT.edges,
        {
          id: 'e3',
          relation: {},
          relationType: 'contains',
          sourceId: 'b',
          targetId: 'c',
          path: 'M 800 60 L 900 60',
        },
      ],
    } as unknown as LocationGraphLayout;
    const { root } = await renderGraph({
      layout: three,
      selectedNodeId: 'a',
      focusNodeIds: new Set(['a', 'b']),
    });
    await fireLayout(root);

    // The contains line from the focused node: solid, thicker, fully opaque.
    expect(pathOf(root, 'M 200 60 L 600 460').props).toMatchObject({
      strokeWidth: 2.6,
      opacity: 1,
    });
    // The connected_to line also touches it.
    expect(pathOf(root, 'M 600 460 L 200 60').props).toMatchObject({
      strokeWidth: 2.2,
      opacity: 1,
    });
    // The one between the neighbours does not.
    expect(pathOf(root, 'M 800 60 L 900 60').props).toMatchObject({
      strokeWidth: 1.8,
      opacity: 0.15,
    });
  });

  it('keeps the usual styles while nothing is selected', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    expect(pathOf(root, 'M 200 60 L 600 460').props).toMatchObject({
      color: '#85f',
      strokeWidth: 1.8,
      opacity: 0.9,
    });
    expect(pathOf(root, 'M 600 460 L 200 60').props).toMatchObject({
      color: '#aaa',
      strokeWidth: 1.4,
      opacity: 0.65,
    });
  });
});

describe('location graph nodes', () => {
  it('are buttons a screen reader can name, and selecting one reports it', async () => {
    const onSelectNode = jest.fn();
    const { view } = await renderGraph({ onSelectNode });

    await fireEvent.press(view.getByRole('button', { name: 'place b' }));

    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('fade when they are out of the focus, and only those', async () => {
    const { view } = await renderGraph({
      selectedNodeId: 'a',
      focusNodeIds: new Set(['a']),
    });
    await fireLayout(view.container);

    const opacityOf = (label: string) => {
      const inner = view.getByText(label).parent as NonNullable<
        ReturnType<typeof view.getByText>['parent']
      >;
      return StyleSheet.flatten(inner.props.style).opacity;
    };
    expect(opacityOf('A')).toBeUndefined();
    expect(opacityOf('B')).toBeLessThan(0.5);
  });

  it('are inside a canvas named for a screen reader', async () => {
    const { view } = await renderGraph({ label: 'Location Structure Map' });

    expect(view.getByLabelText('Location Structure Map').props.role).toBe('region');
  });
});

describe('location graph arrowheads', () => {
  const withArrow = {
    ...LAYOUT,
    edges: [
      { ...LAYOUT.edges[0], arrow: '600,460 590,450 592,462' },
      { ...LAYOUT.edges[1], arrow: null },
    ],
  } as unknown as LocationGraphLayout;

  it('draws the arrowhead of a contains line, and none for the other kind', async () => {
    const { root } = await renderGraph({ layout: withArrow });
    await fireLayout(root);

    const heads = root.queryAll(
      (node) => node.type === 'SkiaPath' && node.props.path === 'M 600,460 L 590,450 L 592,462 Z',
    );
    expect(heads).toHaveLength(1);
    expect(heads[0].props.color).toBe('#85f');
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(3);
  });

  it('fades the arrowhead with its line while another node is in focus', async () => {
    const { root } = await renderGraph({
      layout: withArrow,
      selectedNodeId: 'c',
      focusNodeIds: new Set(['c']),
    });
    await fireLayout(root);

    const head = root.queryAll(
      (node) => node.type === 'SkiaPath' && node.props.path === 'M 600,460 L 590,450 L 592,462 Z',
    )[0];
    expect(head.props.opacity).toBe(0.15);
  });
});

describe('location graph folded regions', () => {
  it('shows how many places are folded into a region, on that region only', async () => {
    const { view } = await renderGraph({ hiddenCounts: new Map([['a', 4]]) });
    await fireLayout(view.container);

    expect(view.getByText('+4')).toBeTruthy();
    expect(view.queryAllByText(/^\+\d+$/)).toHaveLength(1);
  });

  it('shows no count when nothing is folded', async () => {
    const { view } = await renderGraph();
    await fireLayout(view.container);

    expect(view.queryAllByText(/^\+\d+$/)).toHaveLength(0);
  });
});
