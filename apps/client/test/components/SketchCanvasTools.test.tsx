import { fireEvent, render, screen } from '@testing-library/react-native';
import SketchCanvasTools from '../../src/components/features/sketches/SketchCanvasTools';
import { useSketchCompact } from '../../src/hooks/useSketchCompact';

jest.mock('../../src/hooks/useSketchCompact', () => ({
  ...jest.requireActual('../../src/hooks/useSketchCompact'),
  useSketchCompact: jest.fn(() => false),
}));
jest.mock('../../src/guides/useGuideAnchor', () => ({ useScreenAnchor: () => undefined }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ddd',
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      onPrimary: '#fff',
    },
  }),
}));
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: ({ children }: any) => <View>{children}</View> };
});

function props(overrides: Record<string, unknown> = {}) {
  return {
    tool: 'brush' as const,
    brush: 'pen' as const,
    canEdit: true,
    canUndo: true,
    canRedo: false,
    rotationActive: false,
    onTool: jest.fn(),
    onBrush: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onResetRotation: jest.fn(),
    onOpenLayers: jest.fn(),
    onOpenPage: jest.fn(),
    ...overrides,
  };
}

const ALL_TOOLS = [
  'hand',
  'select',
  'brush',
  'eraser',
  'fill',
  'eyedropper',
  'line',
  'rect',
  'ellipse',
  'text',
  'balloon',
  'stamp',
];

describe('SketchCanvasTools on a wide screen', () => {
  beforeEach(() => jest.mocked(useSketchCompact).mockReturnValue(false));

  it('shows every tool and the page button, and arms a tool in one tap', async () => {
    const p = props();
    await render(<SketchCanvasTools {...p} />);
    for (const id of ALL_TOOLS) {
      expect(screen.getByTestId(`sketch-tool-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('sketch-page')).toBeTruthy();
    expect(screen.queryByTestId('sketch-group-draw')).toBeNull();
    await fireEvent.press(screen.getByTestId('sketch-tool-eraser'));
    expect(p.onTool).toHaveBeenCalledWith('eraser');
  });
});

describe('SketchCanvasTools on a small screen', () => {
  beforeEach(() => jest.mocked(useSketchCompact).mockReturnValue(true));

  it('folds the twelve tools into three groups plus undo, redo, layers and an overflow', async () => {
    await render(<SketchCanvasTools {...props()} />);
    for (const id of ['sketch-group-navigate', 'sketch-group-draw', 'sketch-group-shapes']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    for (const id of ['sketch-undo', 'sketch-redo', 'sketch-layers', 'sketch-more']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(screen.queryByTestId('sketch-tool-brush')).toBeNull();
    expect(screen.queryByTestId('sketch-page')).toBeNull();
  });

  it('arms the remembered tool of an idle group in one tap and opens the menu on the armed one', async () => {
    const p = props({ tool: 'brush' });
    await render(<SketchCanvasTools {...p} />);
    // The navigate group is idle: one tap arms its first tool (hand).
    await fireEvent.press(screen.getByTestId('sketch-group-navigate'));
    expect(p.onTool).toHaveBeenCalledWith('hand');
    // The draw group holds the armed brush: a tap opens its menu instead.
    expect(screen.queryByTestId('sketch-menu-brush-marker')).toBeNull();
    await fireEvent.press(screen.getByTestId('sketch-group-draw'));
    expect(screen.getByTestId('sketch-menu-brush-marker')).toBeTruthy();
    expect(screen.getByTestId('sketch-menu-brush-pen').props.accessibilityState.selected).toBe(
      true,
    );
    await fireEvent.press(screen.getByTestId('sketch-menu-brush-marker'));
    expect(p.onBrush).toHaveBeenCalledWith('marker');
    expect(screen.queryByTestId('sketch-menu-brush-marker')).toBeNull();
  });

  it('opens the menu on a long press and offers the eraser and the bucket there', async () => {
    const p = props({ tool: 'hand' });
    await render(<SketchCanvasTools {...p} />);
    await fireEvent(screen.getByTestId('sketch-group-draw'), 'longPress');
    expect(screen.getByTestId('sketch-menu-fill')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sketch-menu-eraser'));
    expect(p.onTool).toHaveBeenCalledWith('eraser');
  });

  it('wears the icon of the armed tool on its group button', async () => {
    const view = await render(<SketchCanvasTools {...props({ tool: 'rect' })} />);
    const iconOf = (id: string) =>
      screen.getByTestId(id).queryAll((node) => node.type === 'Icon')[0].props.name;
    expect(iconOf('sketch-group-shapes')).toBe('square-outline');
    await view.rerender(<SketchCanvasTools {...props({ tool: 'brush', brush: 'marker' })} />);
    expect(iconOf('sketch-group-draw')).toBe('brush-outline');
  });

  it('moves the page and the view reset behind the overflow menu', async () => {
    const p = props({ rotationActive: true });
    await render(<SketchCanvasTools {...p} />);
    await fireEvent.press(screen.getByTestId('sketch-more'));
    expect(screen.getByTestId('sketch-menu-rotation')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sketch-menu-page'));
    expect(p.onOpenPage).toHaveBeenCalledTimes(1);
  });

  it('keeps undo and layers one tap away', async () => {
    const p = props();
    await render(<SketchCanvasTools {...p} />);
    await fireEvent.press(screen.getByTestId('sketch-undo'));
    await fireEvent.press(screen.getByTestId('sketch-layers'));
    expect(p.onUndo).toHaveBeenCalledTimes(1);
    expect(p.onOpenLayers).toHaveBeenCalledTimes(1);
  });

  it('shows no tools when read-only, only layers', async () => {
    await render(<SketchCanvasTools {...props({ canEdit: false })} />);
    expect(screen.queryByTestId('sketch-group-draw')).toBeNull();
    expect(screen.queryByTestId('sketch-undo')).toBeNull();
    expect(screen.queryByTestId('sketch-more')).toBeNull();
    expect(screen.getByTestId('sketch-layers')).toBeTruthy();
  });
});
