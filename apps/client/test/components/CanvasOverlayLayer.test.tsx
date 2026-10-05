import { act, render, type RenderResult } from '@testing-library/react-native';
import type { SkFont } from '@shopify/react-native-skia';
import { matchFont } from '@shopify/react-native-skia';
import type { BoardContentType, CanvasOverlayType, SpatialRect } from '@keres/shared';
import { StyleSheet, View } from 'react-native';
import BoardCanvas from '../../src/components/features/boards/BoardCanvas';
import CanvasOverlayLayer from '../../src/components/features/graphs/CanvasOverlay/CanvasOverlayLayer';
import CanvasStampView from '../../src/components/features/graphs/CanvasOverlay/CanvasStampView';

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
jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const { View: HostView } = jest.requireActual('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const ReactActual = jest.requireActual('react');
  return {
    Ionicons: ({ name, color, size }: { name: string; color: string; size: number }) =>
      ReactActual.createElement(HostView, {
        testID: `stamp-icon:${name}:${color}:${size}`,
      }),
  };
});
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({ useResolvedMediaUri: () => null }));

type Root = RenderResult['container'];

const WINDOW: SpatialRect = { x: -100, y: -100, width: 1000, height: 1000 };
const FONT = matchFont({ fontSize: 11 }) as SkFont;

const LINE: CanvasOverlayType = {
  id: '03PQRSTV',
  kind: 'line',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
};

function strokePathsOf(root: Root): string[] {
  return root
    .queryAll((node) => node.type === 'SkiaPath' && node.props.style === 'stroke')
    .map((candidate) => candidate.props.path as string);
}

function filledPathsOf(root: Root): string[] {
  return root
    .queryAll((node) => node.type === 'SkiaPath' && node.props.style !== 'stroke')
    .map((candidate) => candidate.props.path as string);
}

async function renderLayer(
  overlays: readonly CanvasOverlayType[] | undefined,
  font: SkFont | null = FONT,
  renderWindow: SpatialRect = WINDOW,
) {
  const view = await render(
    <CanvasOverlayLayer
      overlays={overlays}
      renderWindow={renderWindow}
      stroke="#fff"
      labelBackground="#000"
      font={font}
    />,
  );
  return view.container;
}

describe('CanvasOverlayLayer', () => {
  it('draws one path per vector kind from shared geometry', async () => {
    const root = await renderLayer([
      LINE,
      {
        id: '04WXYZ12',
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
      },
      { id: '05ABCDHJ', kind: 'frame', x: 20, y: 20, width: 100, height: 60 },
      {
        id: '06KMPQRT',
        kind: 'shape',
        shapeType: 'ellipse',
        x: 0,
        y: 0,
        width: 20,
        height: 10,
      },
    ]);

    expect(strokePathsOf(root)).toEqual([
      'M 0 0 L 10 10',
      'M 0 0 L 10 0 L 5 8 Z',
      'M 20 20 L 120 20 L 120 80 L 20 80 Z',
      'M 0 5 A 10 5 0 1 0 20 5 A 10 5 0 1 0 0 5 Z',
    ]);
    // Regions start as outlines: nothing adds a filled path without `filled`.
    expect(filledPathsOf(root)).toEqual([]);
  });

  it('fills and dashes regions on request', async () => {
    const root = await renderLayer([
      {
        id: '04WXYZ12',
        kind: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
        filled: true,
        dashed: true,
        fillOpacity: 0.5,
      },
      { id: '05ABCDHJ', kind: 'frame', x: 20, y: 20, width: 100, height: 60, filled: true },
      {
        id: '06KMPQRT',
        kind: 'shape',
        shapeType: 'ellipse',
        x: 0,
        y: 0,
        width: 20,
        height: 10,
        dashed: true,
      },
    ]);

    const fills = root.queryAll(
      (node) => node.type === 'SkiaPath' && node.props.style !== 'stroke',
    );
    expect(fills.map((fill) => fill.props.path)).toEqual([
      'M 0 0 L 10 0 L 5 8 Z',
      'M 20 20 L 120 20 L 120 80 L 20 80 Z',
    ]);
    expect(fills[0].props.opacity).toBe(0.5);
    expect(fills[1].props.opacity).toBe(0.25);
    // Dashed polygon and shape plus the frame's default dash.
    expect(root.queryAll((node) => node.type === 'SkiaDashPathEffect')).toHaveLength(3);
  });

  it('dashes frames by default and lines on request', async () => {
    const root = await renderLayer([
      { ...LINE, dashed: true },
      { id: '05ABCDHJ', kind: 'frame', x: 0, y: 0, width: 10, height: 10 },
      { id: '06KMPQRT', kind: 'frame', x: 30, y: 30, width: 10, height: 10, dashed: false },
    ]);

    const dashes = root.queryAll((node) => node.type === 'SkiaDashPathEffect');
    expect(dashes).toHaveLength(2);
    for (const dash of dashes) expect(dash.props.intervals).toEqual([6, 4]);
  });

  it('draws the directed arrowhead at the last point', async () => {
    const root = await renderLayer([{ ...LINE, directed: true }]);

    expect(strokePathsOf(root)).toEqual(['M 0 0 L 10 10']);
    const [head] = filledPathsOf(root);
    expect(head).toMatch(/^M 10,10 L .* Z$/);
  });

  it('halos the label at the bounds center and skips it without a font', async () => {
    const labeled = await renderLayer([{ ...LINE, label: 'hi' }]);
    const texts = labeled.queryAll((node) => node.type === 'SkiaText');
    expect(texts).toHaveLength(2);
    // Bounds center (5,5); the mock font measures six units per glyph.
    expect(texts[0].props).toMatchObject({
      text: 'hi',
      x: -1,
      y: 5,
      color: '#000',
      style: 'stroke',
    });
    expect(texts[1].props).toMatchObject({ text: 'hi', x: -1, y: 5, color: '#fff' });

    const unfonted = await renderLayer([{ ...LINE, label: 'hi' }], null);
    expect(unfonted.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
    expect(strokePathsOf(unfonted)).toEqual(['M 0 0 L 10 10']);
  });

  it('honors color, width and fill opacity, and culls outside the window', async () => {
    const root = await renderLayer(
      [
        { ...LINE, id: '07VWXYZ1', color: '#f00', strokeWidth: 5 },
        {
          id: '08ABCDEF',
          kind: 'polygon',
          points: [
            { x: 5000, y: 5000 },
            { x: 5010, y: 5000 },
            { x: 5005, y: 5008 },
          ],
        },
      ],
      FONT,
      { x: 0, y: 0, width: 100, height: 100 },
    );

    const [stroke] = root.queryAll(
      (node) => node.type === 'SkiaPath' && node.props.style === 'stroke',
    );
    expect(stroke.props).toMatchObject({ color: '#f00', strokeWidth: 5 });
    expect(strokePathsOf(root)).toHaveLength(1);
  });

  it('leaves stamps to the native plane', async () => {
    const root = await renderLayer([{ id: '07VWXYZ1', kind: 'stamp', x: 10, y: 10, icon: 'flag' }]);

    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(0);
    expect(root.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
  });

  it('draws text at the overlay size by scaling the one base font, without deriving a new font', async () => {
    // The base font reports its own size (11, like the canvases' edge font) and has no typeface to
    // derive from - the exact situation in which the old approach drew every size the same.
    const base = {
      getSize: () => 11,
      getGlyphIDs: (text: string) => [...text].map((_, index) => index),
      getGlyphWidths: (ids: number[]) => ids.map(() => 6),
    } as unknown as SkFont;
    const draw = async (fontSize: number) => {
      const root = await renderLayer(
        [{ id: '07EFGHJK', kind: 'text', x: 0, y: 0, width: 400, content: 'hi', fontSize }],
        base,
      );
      const [text] = root.queryAll((node) => node.type === 'SkiaText');
      const group = root.queryAll(
        (node) => node.type === 'SkiaGroup' && Array.isArray(node.props.transform),
      )[0];
      return { text, transform: group.props.transform };
    };
    const small = await draw(11);
    const large = await draw(44);
    // The text itself is drawn at the origin with the base font; the transform carries size and place.
    expect(large.text.props).toMatchObject({ text: 'hi', x: 0, y: 0, font: base });
    expect(small.transform).toEqual([{ translateX: 0 }, { translateY: 11 }, { scale: 1 }]);
    expect(large.transform).toEqual([{ translateX: 0 }, { translateY: 44 }, { scale: 4 }]);
  });

  it('centers a scaled line by its scaled width', async () => {
    const base = {
      getSize: () => 10,
      getGlyphIDs: (text: string) => [...text].map((_, index) => index),
      getGlyphWidths: (ids: number[]) => ids.map(() => 5),
    } as unknown as SkFont;
    const root = await renderLayer(
      [
        {
          id: '07EFGHJK',
          kind: 'text',
          x: 0,
          y: 0,
          width: 200,
          content: 'ab',
          fontSize: 20,
          align: 'center',
        },
      ],
      base,
    );
    const group = root.queryAll(
      (node) => node.type === 'SkiaGroup' && Array.isArray(node.props.transform),
    )[0];
    // 'ab' is 10 units at the base size, 20 at fontSize 20 (scale 2): centered in 200 -> x = 90.
    expect(group.props.transform[0]).toEqual({ translateX: 90 });
    expect(group.props.transform[2]).toEqual({ scale: 2 });
  });
});

describe('balloon overlays', () => {
  const BALLOON: CanvasOverlayType = {
    id: '08BALLON',
    kind: 'balloon',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    tail: { x: 330, y: 240 },
    content: 'Who goes there?',
  };

  it('draws one filled body-and-tail path, its outline, and the words inside', async () => {
    const root = await renderLayer([BALLOON]);
    const paths = root.queryAll((node) => node.type === 'SkiaPath');
    expect(paths).toHaveLength(2);
    expect(paths[0].props.path).toBe(paths[1].props.path);
    expect(paths[0].props.path).toContain('A100 50 0 1 1');
    expect(paths[0].props.path).toContain('L330 240');
    expect(paths[1].props.style).toBe('stroke');
    const text = root.queryAll((node) => node.type === 'SkiaText');
    expect(text.length).toBeGreaterThan(0);
    expect(text.map((node) => node.props.text).join(' ')).toBe('Who goes there?');
  });

  it('fills the balloon with its own background color, or the paper tone when it has none', async () => {
    const plain = await renderLayer([BALLOON]);
    expect(plain.queryAll((node) => node.type === 'SkiaPath')[0].props.color).toBe('#000');
    const tinted = await renderLayer([{ ...BALLOON, fillColor: '#ffe08a' }]);
    const [fill, outline] = tinted.queryAll((node) => node.type === 'SkiaPath');
    expect(fill.props.color).toBe('#ffe08a');
    expect(outline.props.style).toBe('stroke');
    expect(outline.props.color).not.toBe('#ffe08a');
  });

  it('still draws the balloon when no font is available (only the words are skipped)', async () => {
    const root = await renderLayer([BALLOON], null);
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(2);
    expect(root.queryAll((node) => node.type === 'SkiaText')).toHaveLength(0);
  });

  it('is culled with its tail: a window that only reaches the tail still draws it', async () => {
    const root = await renderLayer([BALLOON], FONT, { x: 320, y: 230, width: 40, height: 40 });
    expect(root.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(2);
  });
});

describe('CanvasStampView', () => {
  it('centers the glyph and names the icon', async () => {
    const view = await render(
      <CanvasStampView
        stamp={{ id: '07VWXYZ1', kind: 'stamp', x: 50, y: 50, icon: 'flag', label: 'Base' }}
      />,
    );

    expect(view.getByTestId('stamp-icon:flag:#85f:19.8')).toBeTruthy();
    expect(view.getByText('Base')).toBeTruthy();
    const outer = view.getByTestId('stamp-icon:flag:#85f:19.8').parent!.parent!;
    expect(StyleSheet.flatten(outer.props.style)).toMatchObject({ left: 32, top: 32 });
  });

  it('honors explicit size and color', async () => {
    const view = await render(
      <CanvasStampView
        stamp={{
          id: '07VWXYZ1',
          kind: 'stamp',
          x: 50,
          y: 50,
          size: 40,
          icon: 'pin',
          color: '#f00',
        }}
      />,
    );

    expect(view.getByTestId('stamp-icon:pin:#f00:22')).toBeTruthy();
    const outer = view.getByTestId('stamp-icon:pin:#f00:22').parent!.parent!;
    expect(StyleSheet.flatten(outer.props.style)).toMatchObject({ left: 30, top: 30 });
  });
});

describe('canvas overlay wiring', () => {
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
      (callback: (...args: number[]) => void) => callback(0, 0, 400, 300),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('draws board overlays in the Skia layer and stamps on the plane', async () => {
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
    const view = await render(
      <BoardCanvas
        content={
          {
            nodes: [
              {
                id: 'a',
                kind: 'note',
                x: 0,
                y: 0,
                width: 200,
                height: 120,
                title: 'A',
                body: null,
              },
            ],
            edges: [],
            overlays: [LINE, { id: '07VWXYZ1', kind: 'stamp', x: 50, y: 50, icon: 'flag' }],
          } as unknown as BoardContentType
        }
        titles={{ a: { title: 'A', typeLabel: 'note' } }}
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
    const root = view.container;
    const containers = root.queryAll((node) => typeof node.props.onLayout === 'function');
    await act(async () => {
      containers[0].props.onLayout();
    });

    expect(strokePathsOf(root)).toContain('M 0 0 L 10 10');
    expect(view.queryByTestId('stamp-icon:flag:#85f:19.8')).not.toBeNull();
  });
});
