import { fireEvent, render, screen } from '@testing-library/react-native';
import SketchOptionsBar, {
  SKETCH_OPTIONS_BAR_HEIGHT,
  type SketchSelectionActions,
} from '../../src/components/features/sketches/SketchOptionsBar';
import { useSketchCompact } from '../../src/hooks/useSketchCompact';
import { useSketchToolStore } from '../../src/state/sketchToolStore';

jest.mock('../../src/hooks/useSketchCompact', () => ({
  ...jest.requireActual('../../src/hooks/useSketchCompact'),
  useSketchCompact: jest.fn(() => false),
}));

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ccc',
      text: '#111',
      textSecondary: '#666',
      primary: '#85f',
      onPrimary: '#fff',
      background: '#fff',
      error: '#d00',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  useSketchToolStore.getState().reset();
  jest.mocked(useSketchCompact).mockReturnValue(false);
});

function selectionActions(): SketchSelectionActions {
  return {
    count: 2,
    canMoveUp: true,
    canMoveDown: false,
    onDone: jest.fn(),
    onDelete: jest.fn(),
    onDuplicate: jest.fn(),
    onFlip: jest.fn(),
    onReorder: jest.fn(),
    onMoveToLayer: jest.fn(),
  };
}

describe('SketchOptionsBar', () => {
  it('offers brush kind, color, size and opacity for the brush and the shape tools', async () => {
    for (const tool of ['brush', 'line', 'rect', 'ellipse'] as const) {
      const view = await render(
        <SketchOptionsBar tool={tool} onOpenColor={jest.fn()} selection={null} />,
      );
      expect(screen.getByTestId('sketch-brush-pen')).toBeTruthy();
      expect(screen.getByTestId('sketch-color-swatch')).toBeTruthy();
      expect(screen.getByTestId('sketch-size-slider')).toBeTruthy();
      expect(screen.getByTestId('sketch-opacity-slider')).toBeTruthy();
      await view.unmount();
    }
  });

  it('picking a brush kind arms the brush with that kind and remembers its own size', async () => {
    await render(<SketchOptionsBar tool="line" onOpenColor={jest.fn()} selection={null} />);
    await fireEvent.press(screen.getByTestId('sketch-brush-highlighter'));
    const state = useSketchToolStore.getState();
    expect(state.brush).toBe('highlighter');
    expect(state.tool).toBe('brush');
    expect(state.sizeByBrush.highlighter).toBeGreaterThan(state.sizeByBrush.pen);
    expect(state.alphaByBrush.highlighter).toBeLessThan(1);
  });

  it('opens the color sheet from the swatch', async () => {
    const onOpenColor = jest.fn();
    await render(<SketchOptionsBar tool="brush" onOpenColor={onOpenColor} selection={null} />);
    await fireEvent.press(screen.getByTestId('sketch-color-swatch'));
    expect(onOpenColor).toHaveBeenCalledTimes(1);
  });

  it('shows eraser size, and fill tolerance with the layer scope toggle', async () => {
    const eraser = await render(
      <SketchOptionsBar tool="eraser" onOpenColor={jest.fn()} selection={null} />,
    );
    expect(screen.getByTestId('sketch-eraser-size-slider')).toBeTruthy();
    await eraser.unmount();
    await render(<SketchOptionsBar tool="fill" onOpenColor={jest.fn()} selection={null} />);
    expect(screen.getByTestId('sketch-tolerance-slider')).toBeTruthy();
    expect(screen.getByTestId('sketch-gap-slider')).toBeTruthy();
    expect(useSketchToolStore.getState().fillSampleAll).toBe(true);
    await fireEvent.press(screen.getByTestId('sketch-fill-sample'));
    expect(useSketchToolStore.getState().fillSampleAll).toBe(false);
  });

  it('toggles the lasso between whole strokes and cutting', async () => {
    await render(<SketchOptionsBar tool="select" onOpenColor={jest.fn()} selection={null} />);
    expect(useSketchToolStore.getState().lassoMode).toBe('whole');
    await fireEvent.press(screen.getByTestId('sketch-lasso-mode'));
    expect(useSketchToolStore.getState().lassoMode).toBe('cut');
  });

  it('puts the selection actions in the strip while something is selected', async () => {
    const actions = selectionActions();
    await render(<SketchOptionsBar tool="select" onOpenColor={jest.fn()} selection={actions} />);
    await fireEvent.press(screen.getByLabelText('sketch_selection_delete'));
    await fireEvent.press(screen.getByLabelText('sketch_selection_duplicate'));
    await fireEvent.press(screen.getByLabelText('sketch_selection_flip_h'));
    await fireEvent.press(screen.getByLabelText('overlay_bring_to_front'));
    await fireEvent.press(screen.getByLabelText('sketch_selection_layer_up'));
    expect(actions.onDelete).toHaveBeenCalledTimes(1);
    expect(actions.onDuplicate).toHaveBeenCalledTimes(1);
    expect(actions.onFlip).toHaveBeenCalledWith('horizontal');
    expect(actions.onReorder).toHaveBeenCalledWith('front');
    expect(actions.onMoveToLayer).toHaveBeenCalledWith('up');
    // The layer below does not exist: that action is disabled.
    await fireEvent.press(screen.getByLabelText('sketch_selection_layer_down'));
    expect(actions.onMoveToLayer).toHaveBeenCalledTimes(1);
  });

  it('shows a hint for the hand and the eyedropper', async () => {
    const hand = await render(
      <SketchOptionsBar tool="hand" onOpenColor={jest.fn()} selection={null} />,
    );
    expect(screen.getByText('sketch_hint_hand')).toBeTruthy();
    await hand.unmount();
    await render(<SketchOptionsBar tool="eyedropper" onOpenColor={jest.fn()} selection={null} />);
    expect(screen.getByText('sketch_hint_eyedropper')).toBeTruthy();
  });

  it('shows the armed object tool hint with a cancel instead of tool options', async () => {
    const onCancelObject = jest.fn();
    await render(
      <SketchOptionsBar
        tool="balloon"
        objectTool
        onCancelObject={onCancelObject}
        onOpenColor={jest.fn()}
        selection={null}
      />,
    );
    expect(screen.getByText('overlay_draw_balloon_hint')).toBeTruthy();
    expect(screen.queryByTestId('sketch-size-slider')).toBeNull();
    await fireEvent.press(screen.getByTestId('sketch-object-cancel'));
    expect(onCancelObject).toHaveBeenCalledTimes(1);
  });

  it('keeps one fixed height for every tool, so swapping tools never resizes the canvas', async () => {
    const heightOf = () => {
      const bar = screen.getByTestId('sketch-options-bar');
      const flat = ([] as Record<string, unknown>[]).concat(bar.props.style);
      return flat.find((entry) => entry && 'height' in entry)?.height;
    };
    const tools = [
      'hand',
      'select',
      'brush',
      'eraser',
      'fill',
      'eyedropper',
      'line',
      'rect',
      'ellipse',
    ] as const;
    for (const tool of tools) {
      const view = await render(
        <SketchOptionsBar tool={tool} onOpenColor={jest.fn()} selection={null} />,
      );
      expect(heightOf()).toBe(SKETCH_OPTIONS_BAR_HEIGHT);
      await view.unmount();
    }
    // With a selection bar, an armed object tool and a bare tool with no options at all.
    const withSelection = await render(
      <SketchOptionsBar tool="select" onOpenColor={jest.fn()} selection={selectionActions()} />,
    );
    expect(heightOf()).toBe(SKETCH_OPTIONS_BAR_HEIGHT);
    await withSelection.unmount();
    const object = await render(
      <SketchOptionsBar tool="text" objectTool onOpenColor={jest.fn()} selection={null} />,
    );
    expect(heightOf()).toBe(SKETCH_OPTIONS_BAR_HEIGHT);
    await object.unmount();
    await render(<SketchOptionsBar tool="text" onOpenColor={jest.fn()} selection={null} />);
    expect(heightOf()).toBe(SKETCH_OPTIONS_BAR_HEIGHT);
  });
});

describe('SketchOptionsBar on a small screen', () => {
  beforeEach(() => {
    useSketchToolStore.getState().reset();
    jest.mocked(useSketchCompact).mockReturnValue(true);
  });

  it('leaves the brush kinds to the drawing menu and keeps color, size and opacity on the row', async () => {
    await render(<SketchOptionsBar tool="brush" onOpenColor={jest.fn()} selection={null} />);
    expect(screen.queryByTestId('sketch-brush-pen')).toBeNull();
    expect(screen.getByTestId('sketch-color-swatch')).toBeTruthy();
    expect(screen.getByTestId('sketch-size-slider')).toBeTruthy();
    expect(screen.getByTestId('sketch-opacity-slider')).toBeTruthy();
  });

  it('shrinks the fill scope and the lasso mode to icon toggles that still work', async () => {
    const fill = await render(
      <SketchOptionsBar tool="fill" onOpenColor={jest.fn()} selection={null} />,
    );
    expect(screen.queryByText('sketch_fill_all_layers')).toBeNull();
    await fireEvent.press(screen.getByLabelText('sketch_fill_all_layers'));
    expect(useSketchToolStore.getState().fillSampleAll).toBe(false);
    await fill.unmount();
    await render(<SketchOptionsBar tool="select" onOpenColor={jest.fn()} selection={null} />);
    expect(screen.queryByText('sketch_lasso_whole')).toBeNull();
    await fireEvent.press(screen.getByLabelText('sketch_lasso_whole'));
    expect(useSketchToolStore.getState().lassoMode).toBe('cut');
  });

  it('keeps the same fixed height as the wide layout', async () => {
    await render(<SketchOptionsBar tool="brush" onOpenColor={jest.fn()} selection={null} />);
    const flat = ([] as Record<string, unknown>[]).concat(
      screen.getByTestId('sketch-options-bar').props.style,
    );
    expect(flat.find((entry) => entry && 'height' in entry)?.height).toBe(
      SKETCH_OPTIONS_BAR_HEIGHT,
    );
  });
});
