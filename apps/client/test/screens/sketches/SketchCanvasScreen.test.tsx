import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import {
  decodeSketchDocument,
  emptySketchContent,
  encodeSketchDocument,
  type SketchDocument,
} from '@keres/shared';
import SketchCanvasScreen from '../../../src/screens/sketches/SketchCanvasScreen';
import { useSketchToolStore } from '../../../src/state/sketchToolStore';

const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockGetSketch = jest.fn();
const mockUpdateSketch = jest.fn();
const mockHydrate = jest.fn();
const mockRemember = jest.fn();
const mockRasterize = jest.fn();
let mockCanEdit = true;

/** The props the screen hands the canvas; tests call its handlers the way gestures would. */
function canvas() {
  return (global as any).__sketchCanvasProps as {
    doc: SketchDocument;
    tool: string;
    selection: { items: ReadonlySet<unknown> } | null;
    onStrokeCommit: (points: number[]) => void;
    onErase: (path: number[], radius: number) => void;
    onEraseEnd: () => void;
    erasePreview: { path: number[]; radius: number; layerId: string } | null;
    onFillTap: (point: { x: number; y: number }) => void;
    onPick: (point: { x: number; y: number }) => void;
    onLassoCommit: (polygon: number[]) => void;
    onSelectTap: (point: { x: number; y: number }, tolerance: number) => void;
    onTransformCommit: (matrix: Record<string, number>) => void;
  };
}

/** The header's live props (the screen builds the element; the navigator would render it). */
const header = () =>
  (global as any).__headerActions().props as {
    dirty: boolean;
    onSave: () => void;
    onRevert: () => void;
  };
const items = () => canvas().doc.layers[0].items;
const kinds = () => items().map((item) => item.kind);
const stroke = (points: number[]) => act(async () => canvas().onStrokeCommit(points));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: { sketchId: 'sketch-1' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
const mockT = (key: string) => key;
const mockI18n = { language: 'en' };
// `t` must stay referentially stable, as in the app: `load` depends on it.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));
jest.mock('../../../src/hooks/useSketchCompact', () => ({
  ...jest.requireActual('../../../src/hooks/useSketchCompact'),
  useSketchCompact: () => false,
}));
jest.mock('../../../src/guides/useScreenTour', () => ({ useScreenTour: jest.fn() }));
jest.mock('../../../src/guides/useGuideAnchor', () => ({ useScreenAnchor: () => undefined }));
jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        background: '#fff',
        surface: '#f4f4f4',
        text: '#111',
        textSecondary: '#555',
        border: '#ddd',
        primary: '#00f',
        onPrimary: '#fff',
        error: '#f00',
      },
    }),
  };
});

jest.mock('../../../src/components/features/sketches/SketchCanvas', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockSketchCanvas(props: any, ref: any) {
      (global as any).__sketchCanvasProps = props;
      React.useImperativeHandle(ref, () => ({
        zoomBy: jest.fn(),
        fitToScreen: jest.fn(),
        resetRotation: jest.fn(),
        viewportWorldCenter: () => ({ x: 0, y: 0 }),
      }));
      return null;
    }),
  };
});
for (const name of [
  'SketchColorSheet',
  'SketchExportSheet',
  'SketchLayerSheet',
  'SketchPageSheet',
]) {
  jest.mock(`../../../src/components/features/sketches/${name}`, () => ({
    __esModule: true,
    default: () => null,
  }));
}
jest.mock('../../../src/components/features/graphs/CanvasOverlay/OverlaySheet', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/components/features/sketches/sketchRaster', () => ({
  rasterizeSketch: (...args: unknown[]) => mockRasterize(...args),
  sampleRasterColor: () => '#336699',
}));

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = { selectedStory: { id: 'story-1' } };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
jest.mock('../../../src/state/userSettingsStore', () => {
  const state = { userId: 'user-1', exportFormat: 'svg' };
  const useUserSettingsStore = (selector?: (s: any) => any) =>
    typeof selector === 'function' ? selector(state) : state;
  (useUserSettingsStore as any).getState = () => state;
  return { useUserSettingsStore };
});
jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (s: any) => any) => {
    const state = { showNotification: mockNotify };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
jest.mock('../../../src/state/sketchDraftStore', () => ({
  useSketchDraftStore: {
    getState: () => ({ hydrate: mockHydrate, remember: mockRemember }),
  },
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => ({
    role: 'owner',
    canEdit: mockCanEdit,
    canManageStoryPolicy: true,
    loading: false,
  }),
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: ({ renderActions }: any = {}) => {
    (global as any).__headerActions = renderActions;
  },
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/db', () => {
  const db = {};
  return { useDrizzle: () => db };
});
jest.mock('../../../src/services/storymanagement/SketchService', () => ({
  createSketchService: () => ({ getById: mockGetSketch, updateSketch: mockUpdateSketch }),
}));
jest.mock('../../../src/services/storymanagement/GalleryService', () => ({
  createGalleryService: () => ({}),
}));
jest.mock('../../../src/services/MediaFileService', () => ({ mediaFileService: {} }));
jest.mock('../../../src/utils/storyTransfer', () => ({
  buildSketchFileName: () => 'sketch.svg',
  deliverMapExport: jest.fn(),
  deliverSvgMap: jest.fn(),
}));
jest.mock('../../../src/utils/svgRaster', () => ({
  fitRasterSize: () => ({ width: 10, height: 10 }),
  rasterizeMapSvg: jest.fn(),
}));

const row = (version = 1) => ({
  id: 'sketch-1',
  storyId: 'story-1',
  name: 'Throne room',
  description: null,
  coverGalleryId: null,
  isDeleted: false,
  version,
  content: emptySketchContent('AAAAAAAA', 'Layer 1', { width: 200, height: 200, preset: null }),
});

/** A white 40x40 bitmap with a black frame: tapping inside fills the 34x34 interior. */
function framedRaster() {
  const size = 40;
  const data = new Uint8Array(size * size * 4).fill(255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x < 3 || y < 3 || x >= size - 3 || y >= size - 3) {
        const offset = (y * size + x) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = 0;
      }
    }
  }
  return { data, width: size, height: size, scale: 1 };
}

const line = (x: number, y: number, length = 100) => [x, y, x + length / 2, y + 1, x + length, y];

describe('SketchCanvasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanEdit = true;
    mockGetSketch.mockResolvedValue(row());
    mockHydrate.mockResolvedValue(null);
    mockRasterize.mockReturnValue(framedRaster());
    mockUpdateSketch.mockImplementation(async (_user: string, _id: string, changes: any) => ({
      ...row(2),
      ...changes,
    }));
    useSketchToolStore.getState().reset();
  });

  afterEach(() => cleanup());

  async function open() {
    await render(<SketchCanvasScreen />);
    await screen.findByTestId('sketch-tool-brush');
  }

  it('goes back to the page that opened it when there is one, and one screen back otherwise', async () => {
    const { useBackButtonHandler } = jest.requireMock(
      '../../../src/hooks/useBackButtonHandler',
    ) as {
      useBackButtonHandler: jest.Mock;
    };
    const { useHeaderBackActionStore } = jest.requireActual(
      '../../../src/state/headerBackActionStore',
    ) as typeof import('../../../src/state/headerBackActionStore');
    await open();
    const onBack = useBackButtonHandler.mock.calls.at(-1)?.[0].onBack as () => void;

    onBack();
    expect(mockGoBack).toHaveBeenCalledTimes(1);

    const toPages = jest.fn();
    useHeaderBackActionStore.getState().setCrossStackReturnAction(toPages, 'SketchCanvas');
    onBack();
    expect(toPages).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the zoom and export controls on the screen, outside the canvas plane', async () => {
    await open();
    expect(screen.getByLabelText('zoom_in')).toBeTruthy();
    expect(screen.getByLabelText('fit_to_screen')).toBeTruthy();
    expect(screen.getByLabelText('story_map_export')).toBeTruthy();
  });

  it('opens a blank sketch with the brush armed and nothing to save', async () => {
    await open();
    expect(canvas().tool).toBe('brush');
    expect(items()).toHaveLength(0);
    expect(header().dirty).toBe(false);
  });

  it('keeps the brush armed across strokes and makes undo/redo walk them one by one', async () => {
    await open();
    await stroke(line(10, 10));
    await stroke(line(10, 40));
    expect(items()).toHaveLength(2);
    expect(canvas().tool).toBe('brush');
    expect(header().dirty).toBe(true);

    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(items()).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(items()).toHaveLength(0);
    // Back at the saved document itself: clean again, without comparing contents.
    expect(header().dirty).toBe(false);
    await fireEvent.press(screen.getByTestId('sketch-redo'));
    expect(items()).toHaveLength(1);
  });

  it('draws with the chosen brush, color, size and opacity', async () => {
    await open();
    await act(async () => {
      const store = useSketchToolStore.getState();
      store.setBrush('marker');
      store.setColor('#e03131');
      store.setSize(20);
      store.setAlpha(0.5);
    });
    await stroke(line(10, 10));
    expect(items()[0]).toMatchObject({
      kind: 'stroke',
      brush: 'marker',
      color: '#e03131',
      size: 20,
    });
    expect((items()[0] as { alpha: number }).alpha).toBeCloseTo(0.5, 1);
  });

  it('erases along one gesture into a single undo step', async () => {
    await open();
    await stroke(line(0, 50, 100));
    expect(items()).toHaveLength(1);

    await act(async () => canvas().onErase([50, 50], 8));
    await act(async () => canvas().onErase([50, 50, 55, 50], 8));
    // The cut shows live, before the gesture ends.
    expect(items().length).toBe(2);
    await act(async () => canvas().onEraseEnd());
    expect(items()).toHaveLength(2);

    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(items()).toHaveLength(1);
  });

  const fillRings = () => (items()[0] as { rings: number[][] }).rings;

  it('cuts a fill with the eraser: a drag takes a band out and the fill survives around it', async () => {
    await open();
    await act(async () => canvas().onFillTap({ x: 20, y: 20 }));
    expect(kinds()).toEqual(['fill']);
    const before = fillRings();

    await act(async () => canvas().onErase([-5, 20], 4));
    await act(async () => canvas().onErase([-5, 20, 45, 20], 4));
    // Live: the fill is untouched in the document and the canvas shows the eraser path.
    expect(fillRings()).toBe(before);
    expect(canvas().erasePreview?.path).toEqual([-5, 20, 45, 20]);
    expect(canvas().erasePreview?.radius).toBe(4);
    await act(async () => canvas().onEraseEnd());

    expect(canvas().erasePreview).toBeNull();
    expect(kinds()).toEqual(['fill']);
    // Two pieces now, above and below the cut.
    expect(fillRings().length).toBe(2);
    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(fillRings()).toBe(before);
  });

  it('removes a fill that the eraser covers completely, in one undo step', async () => {
    await open();
    await act(async () => canvas().onFillTap({ x: 20, y: 20 }));
    await act(async () => canvas().onErase([20, 20], 60));
    await act(async () => canvas().onEraseEnd());
    expect(kinds()).toEqual([]);
    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(kinds()).toEqual(['fill']);
  });

  it('erases a stroke and the fill beneath it in the same gesture', async () => {
    await open();
    await act(async () => canvas().onFillTap({ x: 20, y: 20 }));
    await stroke([0, 20, 50, 21, 100, 20]);
    expect(kinds()).toEqual(['fill', 'stroke']);

    await act(async () => canvas().onErase([30, 20], 6));
    await act(async () => canvas().onErase([30, 20, 36, 20], 6));
    await act(async () => canvas().onEraseEnd());
    // The stroke was cut in two and the fill lost the same stretch.
    expect(kinds().filter((kind) => kind === 'stroke')).toHaveLength(2);
    expect(kinds()[0]).toBe('fill');
    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(kinds()).toEqual(['fill', 'stroke']);
  });

  it('fills the tapped region and keeps the fill under the strokes', async () => {
    await open();
    await stroke(line(5, 5));
    await act(async () => canvas().onFillTap({ x: 20, y: 20 }));
    expect(kinds()).toEqual(['fill', 'stroke']);
    const fill = items()[0] as { rings: number[][]; color: string };
    expect(fill.rings).toHaveLength(1);
    expect(mockRasterize).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ layerId: 'AAAAAAAA', sampleAll: true }),
    );
  });

  it('ignores a fill or a pick off the page without touching Skia', async () => {
    await open();
    await act(async () => canvas().onFillTap({ x: -10, y: 20 }));
    await act(async () => canvas().onFillTap({ x: 20, y: 500 }));
    await act(async () => canvas().onPick({ x: 900, y: 5 }));
    expect(mockRasterize).not.toHaveBeenCalled();
    expect(items()).toHaveLength(0);
  });

  it('closes small gaps in the outline by the chosen amount and warns when the color leaks', async () => {
    await open();
    await act(async () => useSketchToolStore.getState().setFillGap(8));
    await act(async () => canvas().onFillTap({ x: 20, y: 20 }));
    expect(items()).toHaveLength(1);
    expect(mockNotify).not.toHaveBeenCalledWith('sketch_fill_leak_hint', 'info');

    // An unframed page: the region runs to the border while the sketch has drawing in it.
    mockRasterize.mockReturnValue({
      data: new Uint8Array(40 * 40 * 4).fill(255),
      width: 40,
      height: 40,
      scale: 1,
    });
    await stroke(line(5, 5));
    await act(async () => canvas().onFillTap({ x: 20, y: 20 }));
    expect(mockNotify).toHaveBeenCalledWith('sketch_fill_leak_hint', 'info');
  });

  it('picks a color from the drawing and goes back to the brush', async () => {
    await open();
    await act(async () => useSketchToolStore.getState().setTool('eyedropper'));
    await act(async () => canvas().onPick({ x: 5, y: 5 }));
    expect(useSketchToolStore.getState().color).toBe('#336699');
    expect(useSketchToolStore.getState().tool).toBe('brush');
  });

  it('lassoes strokes, deletes the selection, and undoes it', async () => {
    await open();
    await act(async () => useSketchToolStore.getState().setTool('select'));
    await stroke(line(10, 10, 40));
    await stroke(line(300, 300, 40));
    await act(async () => canvas().onLassoCommit([0, 0, 100, 0, 100, 100, 0, 100]));
    expect(canvas().selection?.items.size).toBe(1);

    await fireEvent.press(screen.getByLabelText('sketch_selection_delete'));
    expect(items()).toHaveLength(1);
    expect(canvas().selection).toBeNull();
    await fireEvent.press(screen.getByTestId('sketch-undo'));
    expect(items()).toHaveLength(2);
  });

  it('selects a tapped stroke and moves it with a committed transform', async () => {
    await open();
    await act(async () => useSketchToolStore.getState().setTool('select'));
    await stroke(line(10, 10, 40));
    await act(async () => canvas().onSelectTap({ x: 30, y: 10 }, 6));
    expect(canvas().selection?.items.size).toBe(1);

    await act(async () => canvas().onTransformCommit({ a: 1, b: 0, c: 0, d: 1, e: 50, f: 25 }));
    const moved = items()[0] as { points: number[] };
    expect(moved.points[0]).toBeCloseTo(60);
    expect(moved.points[1]).toBeCloseTo(35);
    // The moved copy is still the selection, so it can be adjusted again.
    expect(canvas().selection?.items.size).toBe(1);
  });

  it('duplicates the selection on top and selects the copies', async () => {
    await open();
    await act(async () => useSketchToolStore.getState().setTool('select'));
    await stroke(line(10, 10, 40));
    await act(async () => canvas().onSelectTap({ x: 30, y: 10 }, 6));
    await fireEvent.press(screen.getByLabelText('sketch_selection_duplicate'));
    expect(items()).toHaveLength(2);
    expect(canvas().selection?.items.size).toBe(1);
    expect((items()[1] as { points: number[] }).points[0]).toBeGreaterThan(10);
  });

  it('saves the whole drawing as encoded layer data and goes clean', async () => {
    await open();
    await stroke(line(10, 10));
    await act(async () => header().onSave());
    expect(mockUpdateSketch).toHaveBeenCalledTimes(1);
    const content = mockUpdateSketch.mock.calls[0][2].content;
    expect(content.layers[0].data).not.toBe('');
    expect(content.layers[0]).not.toHaveProperty('items');
    expect(mockNotify).toHaveBeenCalledWith('sketch_saved', 'success');
  });

  it('reverts to the last save and drops the history', async () => {
    await open();
    await stroke(line(10, 10));
    await act(async () => header().onRevert());
    expect(items()).toHaveLength(0);
    expect(screen.getByTestId('sketch-undo').props.accessibilityState?.disabled).toBe(true);
  });

  it('restores a draft and warns when the saved sketch moved on', async () => {
    const saved = row(5);
    mockGetSketch.mockResolvedValue(saved);
    const draftDoc = {
      page: { width: 200, height: 200, preset: null, background: 'paper' },
      layers: [
        {
          id: 'AAAAAAAA',
          name: 'Layer 1',
          visible: true,
          opacity: 1,
          locked: false,
          items: [
            {
              kind: 'stroke',
              brush: 'pen',
              color: '#000000',
              alpha: 1,
              size: 3,
              points: [0, 0, 9, 9],
            },
          ],
        },
      ],
      overlays: [],
    };
    mockHydrate.mockResolvedValue({
      sketchId: 'sketch-1',
      storyId: 'story-1',
      doc: draftDoc,
      baseVersion: 2,
    });
    await open();
    expect(items()).toHaveLength(1);
    expect(mockNotify).toHaveBeenCalledWith('canvas_draft_conflicts_with_saved', 'warning');
    expect(header().dirty).toBe(true);
  });

  describe('opening a sketch that was just saved', () => {
    // What the draft store still holds after a save and a close: the drawing, with nothing unsaved in it
    // (`doc` and `savedDoc` are the same object).
    const savedDrawing = () => {
      const doc = {
        page: { width: 200, height: 200, preset: null, background: 'paper' },
        layers: [
          {
            id: 'AAAAAAAA',
            name: 'Layer 1',
            visible: true,
            opacity: 1,
            locked: false,
            items: [
              {
                kind: 'stroke',
                brush: 'pen',
                color: '#000000',
                alpha: 1,
                size: 3,
                points: [0, 0, 9, 9],
              },
            ],
          },
        ],
        overlays: [],
      } as unknown as SketchDocument;
      const content = encodeSketchDocument(doc);
      return { content, remembered: decodeSketchDocument(content) };
    };

    it('is not dirty and does not claim a draft was restored: a draft with nothing unsaved is no draft', async () => {
      const { content, remembered } = savedDrawing();
      mockGetSketch.mockResolvedValue({ ...row(3), content });
      mockHydrate.mockResolvedValue({
        sketchId: 'sketch-1',
        storyId: 'story-1',
        doc: remembered,
        savedDoc: remembered,
        baseVersion: 3,
      });

      await open();

      expect(items()).toHaveLength(1);
      expect(header().dirty).toBe(false);
      expect(mockNotify).not.toHaveBeenCalledWith('canvas_draft_restored', 'info');
      expect(mockNotify).not.toHaveBeenCalledWith('canvas_draft_conflicts_with_saved', 'warning');
    });

    it('shows what the server has now when the saved sketch moved on and nothing was unsaved', async () => {
      const { content, remembered } = savedDrawing();
      // The device saved version 3; a sync brought version 4 (an empty page) before it was opened again.
      mockGetSketch.mockResolvedValue(row(4));
      mockHydrate.mockResolvedValue({
        sketchId: 'sketch-1',
        storyId: 'story-1',
        doc: remembered,
        savedDoc: remembered,
        baseVersion: 3,
      });

      await open();

      expect(items()).toHaveLength(0);
      expect(header().dirty).toBe(false);
      expect(mockNotify).not.toHaveBeenCalledWith('canvas_draft_conflicts_with_saved', 'warning');
      expect(content).toBeTruthy();
    });

    it('still restores real unsaved changes, and stays dirty for them', async () => {
      const { content, remembered } = savedDrawing();
      mockGetSketch.mockResolvedValue({ ...row(3), content });
      const withMore = {
        ...remembered,
        layers: remembered.layers.map((layer) => ({
          ...layer,
          items: [...layer.items, ...layer.items],
        })),
      } as SketchDocument;
      mockHydrate.mockResolvedValue({
        sketchId: 'sketch-1',
        storyId: 'story-1',
        doc: withMore,
        savedDoc: remembered,
        baseVersion: 3,
      });

      await open();

      expect(items()).toHaveLength(2);
      expect(header().dirty).toBe(true);
      expect(mockNotify).toHaveBeenCalledWith('canvas_draft_restored', 'info');
    });
  });

  it('shows an error when the sketch cannot be loaded', async () => {
    mockGetSketch.mockResolvedValue(undefined);
    await render(<SketchCanvasScreen />);
    expect(await screen.findByText('sketch_not_found')).toBeTruthy();
  });

  it('keeps the options strip mounted while an object tool is armed (same slot, same height)', async () => {
    await open();
    expect(screen.getByTestId('sketch-options-bar')).toBeTruthy();
    await act(async () => useSketchToolStore.getState().setTool('text'));
    expect(screen.getByTestId('sketch-options-bar')).toBeTruthy();
    expect(screen.getByText('overlay_draw_text_hint')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sketch-object-cancel'));
    expect(useSketchToolStore.getState().tool).toBe('select');
    expect(screen.getByTestId('sketch-options-bar')).toBeTruthy();
  });

  it('is look-only without edit rights: no tools, hand only', async () => {
    mockCanEdit = false;
    await render(<SketchCanvasScreen />);
    await screen.findByTestId('sketch-layers');
    expect(canvas().tool).toBe('hand');
    expect(screen.queryByTestId('sketch-tool-brush')).toBeNull();
    expect(screen.queryByTestId('sketch-options-bar')).toBeNull();
  });
});
