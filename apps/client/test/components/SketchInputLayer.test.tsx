import { render } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import SketchInputLayer from '../../src/components/features/sketches/SketchInputLayer';

type LayerProps = Parameters<typeof SketchInputLayer>[0];

function event(x: number, y: number) {
  return { nativeEvent: { locationX: x, locationY: y } } as any;
}

async function setup(overrides: Partial<LayerProps> = {}) {
  const create = jest.spyOn(PanResponder, 'create');
  const callbacks = {
    onPreview: jest.fn(),
    onStrokeCommit: jest.fn(),
    onErase: jest.fn(),
    onEraseEnd: jest.fn(),
    onFillTap: jest.fn(),
    onPick: jest.fn(),
    onLassoCommit: jest.fn(),
    onSelectTap: jest.fn(),
    onTransformPreview: jest.fn(),
    onTransformCommit: jest.fn(),
  };
  const props: LayerProps = {
    tool: 'brush',
    screenToWorld: (point) => point,
    scale: 1,
    brushStyle: { brush: 'pen', color: '#112233', alpha: 1, size: 4 },
    eraserSize: 20,
    selectionBounds: null,
    ...callbacks,
    ...overrides,
  };
  await render(<SketchInputLayer {...props} />);
  const [config] = (create as jest.Mock).mock.calls.map((call) => call[0] as any);
  return { config, callbacks };
}

describe('SketchInputLayer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('commits one stroke per drag and keeps the tool armed (no auto-disarm)', async () => {
    const { config, callbacks } = await setup();
    await config.onPanResponderGrant(event(10, 10));
    await config.onPanResponderMove(event(0, 0), { dx: 20, dy: 0 });
    await config.onPanResponderMove(event(0, 0), { dx: 40, dy: 10 });
    await config.onPanResponderRelease(event(0, 0), { dx: 60, dy: 20 });
    expect(callbacks.onStrokeCommit).toHaveBeenCalledTimes(1);
    expect(callbacks.onStrokeCommit).toHaveBeenCalledWith([10, 10, 30, 10, 50, 20, 70, 30]);
    expect(callbacks.onPreview).toHaveBeenLastCalledWith(null);

    // A second stroke needs no re-arming.
    await config.onPanResponderGrant(event(0, 0));
    await config.onPanResponderMove(event(0, 0), { dx: 30, dy: 0 });
    await config.onPanResponderRelease(event(0, 0), { dx: 30, dy: 0 });
    expect(callbacks.onStrokeCommit).toHaveBeenCalledTimes(2);
  });

  it('draws a dot for a tap and previews the live stroke with the brush style', async () => {
    const { config, callbacks } = await setup();
    await config.onPanResponderGrant(event(5, 6));
    expect(callbacks.onPreview).toHaveBeenCalledWith({
      kind: 'stroke',
      stroke: expect.objectContaining({ color: '#112233', size: 4, points: [5, 6] }),
    });
    await config.onPanResponderRelease(event(5, 6), { dx: 0, dy: 0 });
    expect(callbacks.onStrokeCommit).toHaveBeenCalledWith([5, 6]);
  });

  it('abandons a stroke when a second finger takes over the gesture', async () => {
    const { config, callbacks } = await setup();
    await config.onPanResponderGrant(event(10, 10));
    await config.onPanResponderMove(event(0, 0), { dx: 30, dy: 0 });
    await config.onPanResponderTerminate();
    expect(callbacks.onStrokeCommit).not.toHaveBeenCalled();
    expect(callbacks.onPreview).toHaveBeenLastCalledWith(null);
  });

  it('erases along the drag with half the eraser size as the radius, then ends once', async () => {
    const { config, callbacks } = await setup({ tool: 'eraser' });
    await config.onPanResponderGrant(event(50, 50));
    expect(callbacks.onErase).toHaveBeenCalledWith([50, 50], 10);
    await config.onPanResponderMove(event(0, 0), { dx: 30, dy: 0 });
    expect(callbacks.onErase).toHaveBeenLastCalledWith([50, 50, 80, 50], 10);
    await config.onPanResponderRelease(event(0, 0), { dx: 30, dy: 0 });
    expect(callbacks.onEraseEnd).toHaveBeenCalledTimes(1);
  });

  it('erases a disc on a tap: the grant erases, the release ends the gesture once', async () => {
    const { config, callbacks } = await setup({ tool: 'eraser' });
    await config.onPanResponderGrant(event(50, 50));
    await config.onPanResponderRelease(event(50, 50), { dx: 0, dy: 0 });
    expect(callbacks.onErase).toHaveBeenCalledTimes(1);
    expect(callbacks.onErase).toHaveBeenCalledWith([50, 50], 10);
    expect(callbacks.onEraseEnd).toHaveBeenCalledTimes(1);
  });

  it('fills and picks colors on tap only', async () => {
    const fill = await setup({ tool: 'fill' });
    await fill.config.onPanResponderGrant(event(7, 8));
    await fill.config.onPanResponderRelease(event(7, 8), { dx: 0, dy: 0 });
    expect(fill.callbacks.onFillTap).toHaveBeenCalledWith({ x: 7, y: 8 });
    jest.restoreAllMocks();

    const pick = await setup({ tool: 'eyedropper' });
    await pick.config.onPanResponderGrant(event(1, 2));
    await pick.config.onPanResponderRelease(event(1, 2), { dx: 0, dy: 0 });
    expect(pick.callbacks.onPick).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(pick.callbacks.onFillTap).not.toHaveBeenCalled();
  });

  it('draws a rectangle shape from the drag corners', async () => {
    const { config, callbacks } = await setup({ tool: 'rect' });
    await config.onPanResponderGrant(event(10, 10));
    await config.onPanResponderMove(event(0, 0), { dx: 40, dy: 20 });
    await config.onPanResponderRelease(event(0, 0), { dx: 40, dy: 20 });
    expect(callbacks.onStrokeCommit).toHaveBeenCalledWith([10, 10, 50, 10, 50, 30, 10, 30, 10, 10]);
  });

  it('lassos on drag and selects on tap with a zoom-aware tolerance', async () => {
    const { config, callbacks } = await setup({ tool: 'select', scale: 2 });
    await config.onPanResponderGrant(event(0, 0));
    await config.onPanResponderMove(event(0, 0), { dx: 50, dy: 0 });
    await config.onPanResponderMove(event(0, 0), { dx: 50, dy: 50 });
    await config.onPanResponderRelease(event(0, 0), { dx: 0, dy: 50 });
    expect(callbacks.onLassoCommit).toHaveBeenCalledTimes(1);
    const polygon = callbacks.onLassoCommit.mock.calls[0][0] as number[];
    expect(polygon.length).toBeGreaterThanOrEqual(6);

    await config.onPanResponderGrant(event(9, 9));
    await config.onPanResponderRelease(event(9, 9), { dx: 0, dy: 0 });
    expect(callbacks.onSelectTap).toHaveBeenCalledWith({ x: 9, y: 9 }, 6);
  });

  it('drags the selection body as a translation, previewed and committed', async () => {
    const { config, callbacks } = await setup({
      tool: 'select',
      selectionBounds: { x: 100, y: 100, width: 200, height: 100 },
    });
    await config.onPanResponderGrant(event(200, 150));
    await config.onPanResponderMove(event(0, 0), { dx: 30, dy: -20 });
    expect(callbacks.onTransformPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ e: 30, f: -20 }),
    );
    await config.onPanResponderRelease(event(0, 0), { dx: 30, dy: -20 });
    expect(callbacks.onTransformCommit).toHaveBeenCalledWith(
      expect.objectContaining({ a: 1, d: 1, e: 30, f: -20 }),
    );
    expect(callbacks.onLassoCommit).not.toHaveBeenCalled();
  });

  it('keeps one responder across re-renders and reads the latest props', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const first = jest.fn();
    const base: LayerProps = {
      tool: 'brush',
      screenToWorld: (point) => point,
      scale: 1,
      brushStyle: { brush: 'pen', color: '#000000', alpha: 1, size: 3 },
      eraserSize: 20,
      selectionBounds: null,
      onPreview: jest.fn(),
      onStrokeCommit: first,
      onErase: jest.fn(),
      onEraseEnd: jest.fn(),
      onFillTap: jest.fn(),
      onPick: jest.fn(),
      onLassoCommit: jest.fn(),
      onSelectTap: jest.fn(),
      onTransformPreview: jest.fn(),
      onTransformCommit: jest.fn(),
    };
    const view = await render(<SketchInputLayer {...base} />);
    expect(create).toHaveBeenCalledTimes(1);
    const second = jest.fn();
    await view.rerender(<SketchInputLayer {...base} onStrokeCommit={second} />);
    expect(create).toHaveBeenCalledTimes(1);
    const [config] = (create as jest.Mock).mock.calls[0] as any[];
    await config.onPanResponderGrant(event(1, 1));
    await config.onPanResponderRelease(event(1, 1), { dx: 0, dy: 0 });
    expect(second).toHaveBeenCalledWith([1, 1]);
    expect(first).not.toHaveBeenCalled();
  });
});
