import { act, render, type RenderResult } from '@testing-library/react-native';
import * as SkiaMock from '@shopify/react-native-skia';
import type { StoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';
import React, { createRef } from 'react';
import { StyleSheet, View } from 'react-native';
import StoryGraphCanvas, {
  type StoryGraphCanvasHandle,
} from '../../src/components/features/graphs/StoryGraph/StoryGraphCanvas';
import SkiaEdgeCanvas from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      primary: '#85f',
      accent: '#5f8',
      error: '#c33',
      surface: '#111',
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
      x: 0,
      y: 0,
      width: 200,
      height: 120,
      chapterColor: '#123',
      labelLines: ['A'],
      chapterName: null,
      isStart: true,
      isFinish: false,
    },
    {
      id: 'b',
      x: 600,
      y: 400,
      width: 200,
      height: 120,
      chapterColor: '#123',
      labelLines: ['B'],
      chapterName: null,
      isStart: false,
      isFinish: true,
    },
  ],
  edges: [
    {
      id: 'e1',
      kind: 'forward',
      path: 'M 200 60 L 600 460',
      color: '#f00',
      label: 'go',
      labelPosition: { x: 400, y: 260 },
      arrowPoints: '600,460 590,450 590,470',
    },
    {
      id: 'e2',
      kind: 'backward',
      path: 'M 600 460 L 200 60',
      color: '#0f0',
      label: 'a choice label far too long to fit on one plate line',
      labelPosition: { x: 400, y: 300 },
      arrowPoints: '200,60 210,50 210,70',
    },
  ],
  width: 800,
  height: 520,
} as unknown as StoryGraphLayout;

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

async function renderGraph(showEdgeLabels = true) {
  const ref = createRef<StoryGraphCanvasHandle>();
  const view = await render(
    <StoryGraphCanvas
      ref={ref}
      layout={LAYOUT}
      showEdgeLabels={showEdgeLabels}
      selectedNodeId={null}
      onSelectNode={noop}
    />,
  );
  return { ref, root: view.container };
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

describe('story graph skia overlay', () => {
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

  it('dashes return edges and fills arrowheads from their points', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    const strokes = root
      .queryAll((node) => node.type === 'SkiaPath')
      .filter((path) => path.props.style === 'stroke');
    expect(strokes.map((path) => path.props.path).sort()).toEqual([
      'M 200 60 L 600 460',
      'M 600 460 L 200 60',
    ]);
    const forward = strokes.find((path) => path.props.color === '#f00')!;
    const backward = strokes.find((path) => path.props.color === '#0f0')!;
    expect(forward.props.opacity).toBe(0.7);
    expect(backward.props.opacity).toBe(0.9);

    // The dash rhythm matches the old `strokeDasharray="7,5"`; the forward edge stays solid.
    const dashes = root.queryAll((node) => node.type === 'SkiaDashPathEffect');
    expect(dashes).toHaveLength(1);
    expect(dashes[0].props.intervals).toEqual([7, 5]);
    const dashKids = (path: any) =>
      React.Children.toArray(path.props.children).filter(Boolean);
    expect(dashKids(forward)).toHaveLength(0);
    expect(dashKids(backward)).toHaveLength(1);

    // Arrowheads cross the port as filled paths converted from the same points.
    const heads = root
      .queryAll((node) => node.type === 'SkiaPath')
      .filter((path) => path.props.style !== 'stroke');
    expect(heads.map((path) => path.props.path).sort()).toEqual([
      'M 200,60 L 210,50 L 210,70 Z',
      'M 600,460 L 590,450 L 590,470 Z',
    ]);
    for (const head of heads) {
      expect(head.props.style).toBeUndefined();
      expect(head.props.color).toMatch(/^#(f00|0f0)$/);
    }
  });

  it('centers clipped labels on measured width over a background plate', async () => {
    const { root } = await renderGraph();
    await fireLayout(root);

    const clipped = 'a choice label far too lo…';
    const texts = root.queryAll((node) => node.type === 'SkiaText');
    expect(texts.map((text) => text.props.text).sort()).toEqual([clipped, 'go']);

    const plates = root.queryAll((node) => node.type === 'SkiaRoundedRect');
    expect(plates).toHaveLength(2);
    const go = texts.find((text) => text.props.text === 'go')!;
    expect(go.props).toMatchObject({
      x: 400 - (2 * 6) / 2,
      y: 260 + 4,
      text: 'go',
      color: '#aaa',
    });
    const plate = plates.find((candidate) => candidate.props.width === 2 * 6.4 + 10)!;
    expect(plate.props).toMatchObject({
      x: 400 - (2 * 6.4 + 10) / 2,
      y: 260 - 8,
      height: 16,
      r: 4,
      color: '#000',
      opacity: 0.92,
    });
  });

  it('draws no labels when they are disabled', async () => {
    const { root } = await renderGraph(false);
    await fireLayout(root);

    expect(root.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaRoundedRect')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(4);
  });

  it('draws edges without labels when the system font is unavailable', async () => {
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
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(4);
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
