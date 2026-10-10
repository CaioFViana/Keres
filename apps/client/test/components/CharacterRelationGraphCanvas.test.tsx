import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import * as SkiaMock from '@shopify/react-native-skia';
import type { CharacterRelationGraphLayout } from '@keres/shared/graphs/characterRelationGraphLayout';
import React, { createRef } from 'react';
import { StyleSheet, View } from 'react-native';
import CharacterRelationGraphCanvas, {
  type CharacterRelationGraphCanvasHandle,
} from '../../src/components/features/graphs/CharacterRelationGraph/CharacterRelationGraphCanvas';
import SkiaEdgeCanvas from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
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
      labelLines: ['A'],
      isIsolated: false,
      x: 0,
      y: 0,
      width: 200,
      height: 120,
    },
    {
      id: 'b',
      labelLines: ['B'],
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
      path: 'M 200 60 L 600 460',
      label: 'ally',
      labelPosition: { x: 400, y: 260 },
    },
    {
      id: 'e2',
      path: 'M 600 460 L 200 60',
      label: 'this relation name is far too long for one line',
      labelPosition: { x: 400, y: 300 },
    },
    { id: 'e3', path: 'M 0 0 L 10 10', label: '   ', labelPosition: { x: 5, y: 5 } },
  ],
  width: 800,
  height: 520,
} as unknown as CharacterRelationGraphLayout;

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

async function renderGraph(
  showEdgeLabels = true,
  props: Partial<React.ComponentProps<typeof CharacterRelationGraphCanvas>> = {},
) {
  const ref = createRef<CharacterRelationGraphCanvasHandle>();
  const view = await render(
    <CharacterRelationGraphCanvas
      ref={ref}
      layout={LAYOUT}
      showEdgeLabels={showEdgeLabels}
      selectedNodeId={null}
      nodeAccessibilityLabel={(node) => `node ${node.id}`}
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

describe('character relation graph skia overlay', () => {
  it('keeps the canvas viewport-sized below scale one, never world-sized', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    expect(transformOf(root).scale).toBeLessThan(1);

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
  });

  it('paints the overlay before the plane, outside the animated transform', async () => {
    const { root } = await renderGraph();
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

  it('draws every edge in world coordinates with the relation style', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    const paths = root.queryAll((node) => node.type === 'SkiaPath');
    expect(paths.map((path) => path.props.path).sort()).toEqual([
      'M 0 0 L 10 10',
      'M 200 60 L 600 460',
      'M 600 460 L 200 60',
    ]);
    for (const path of paths) {
      expect(path.props).toMatchObject({
        style: 'stroke',
        color: '#444',
        strokeWidth: 1.6,
        opacity: 0.85,
      });
    }
  });

  it('centers clipped labels on measured width over a background plate', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    // The blank label draws nothing; the long one clips to 21 characters plus ellipsis.
    const clipped = 'this relation name is…';
    const texts = root.queryAll((node) => node.type === 'SkiaText');
    expect(texts.map((text) => text.props.text).sort()).toEqual(['ally', clipped]);

    const plates = root.queryAll((node) => node.type === 'SkiaRoundedRect');
    expect(plates).toHaveLength(2);
    const ally = texts.find((text) => text.props.text === 'ally')!;
    const plate = plates.find((candidate) => candidate.props.width === 4 * 6.2 + 10)!;
    // Background plate keeps the historical sizing heuristic, centered on the label point.
    expect(plate.props).toMatchObject({
      x: 400 - (4 * 6.2 + 10) / 2,
      y: 260 - 8,
      width: 4 * 6.2 + 10,
      height: 16,
      r: 4,
      color: '#000',
      opacity: 0.92,
    });
    // The mock font measures 6 units per character: the text starts half of that left of
    // center, replacing `textAnchor="middle"`; the baseline sits at the same y as before.
    expect(ally.props).toMatchObject({
      x: 400 - (4 * 6) / 2,
      y: 260 + 4,
      text: 'ally',
      color: '#aaa',
    });
    expect(ally.props.font).toBeTruthy();
  });

  it('draws no labels when they are disabled', async () => {
    const { root } = await renderGraph(false);
    await fireLayout(root);

    expect(root.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaRoundedRect')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(3);
  });

  it('draws edges without labels when no font is available (bundled not loaded, system unmatched)', async () => {
    jest.spyOn(SkiaMock, 'useFont').mockReturnValue(null as never);
    // Web: `matchFamilyStyle` is unimplemented and throws; the canvas must survive with
    // edges only, never a black screen.
    jest.spyOn(SkiaMock, 'matchFont').mockImplementation(() => {
      throw new Error('Not implemented on React Native Web');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { root } = await renderGraph();
    await fireLayout(root);

    expect(root.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaRoundedRect')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(3);
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

/** Two characters, a third unrelated to the first, and the edges between them. */
const FOCUS_LAYOUT = {
  nodes: ['a', 'b', 'c'].map((id, index) => ({
    id,
    labelLines: [id.toUpperCase()],
    isIsolated: false,
    x: index * 300,
    y: 0,
    width: 112,
    height: 44,
  })),
  edges: [
    {
      id: 'ab',
      sourceId: 'a',
      targetId: 'b',
      path: 'M ab',
      label: 'friend',
      labelPosition: { x: 1, y: 1 },
    },
    {
      id: 'bc',
      sourceId: 'b',
      targetId: 'c',
      path: 'M bc',
      label: 'rival',
      labelPosition: { x: 2, y: 2 },
    },
  ],
  width: 900,
  height: 100,
} as unknown as CharacterRelationGraphLayout;

const pathOf = (root: Root, path: string) =>
  root.queryAll((node) => node.type === 'SkiaPath' && node.props.path === path)[0];

describe('character relation graph with a node in focus', () => {
  it('draws the lines of the focused node strong and the rest barely there', async () => {
    const { root } = await renderGraph(true, {
      layout: FOCUS_LAYOUT,
      selectedNodeId: 'a',
      focusNodeIds: new Set(['a', 'b']),
    });
    await fireLayout(root);

    expect(pathOf(root, 'M ab').props).toMatchObject({
      color: '#85f',
      strokeWidth: 2.4,
      opacity: 1,
    });
    expect(pathOf(root, 'M bc').props).toMatchObject({
      color: '#444',
      strokeWidth: 1.6,
      opacity: 0.15,
    });
  });

  it('writes only the relation types of the focused node', async () => {
    const { root } = await renderGraph(true, {
      layout: FOCUS_LAYOUT,
      selectedNodeId: 'a',
      focusNodeIds: new Set(['a', 'b']),
    });
    await fireLayout(root);

    expect(root.queryAll((node) => node.type === 'SkiaText').map((t) => t.props.text)).toEqual([
      'friend',
    ]);
  });

  it('writes every relation type when nothing is in focus', async () => {
    const { root } = await renderGraph(true, { layout: FOCUS_LAYOUT });
    await fireLayout(root);

    expect(
      root
        .queryAll((node) => node.type === 'SkiaText')
        .map((t) => t.props.text)
        .sort(),
    ).toEqual(['friend', 'rival']);
  });
});

describe('character relation graph nodes', () => {
  it('are buttons a screen reader can name, and selecting one reports it', async () => {
    const onSelectNode = jest.fn();
    const { view } = await renderGraph(true, { layout: FOCUS_LAYOUT, onSelectNode });

    await fireEvent.press(view.getByRole('button', { name: 'node b' }));

    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('fade when they are out of the focus, and only those', async () => {
    const { view } = await renderGraph(true, {
      layout: FOCUS_LAYOUT,
      selectedNodeId: 'a',
      focusNodeIds: new Set(['a', 'b']),
    });
    await fireLayout(view.container);

    const opacityOf = (id: string) => {
      const inner = view.getByText(id.toUpperCase()).parent as NonNullable<
        ReturnType<typeof view.getByText>['parent']
      >;
      return StyleSheet.flatten(inner.props.style).opacity;
    };
    expect(opacityOf('a')).toBeUndefined();
    expect(opacityOf('b')).toBeUndefined();
    expect(opacityOf('c')).toBeLessThan(0.5);
  });

  it('fill the selected one', async () => {
    const { view } = await renderGraph(true, {
      layout: FOCUS_LAYOUT,
      selectedNodeId: 'b',
      focusNodeIds: new Set(['a', 'b', 'c']),
    });
    await fireLayout(view.container);

    expect(view.getByRole('button', { name: 'node b' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByRole('button', { name: 'node a' }).props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('are inside a canvas named for a screen reader', async () => {
    const { view } = await renderGraph(true, { label: 'Relation Map' });

    expect(view.getByLabelText('Relation Map').props.role).toBe('region');
  });
});
