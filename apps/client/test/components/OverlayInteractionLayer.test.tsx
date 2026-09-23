import { render } from '@testing-library/react-native';
import type { CanvasOverlayType } from '@keres/shared';
import { PanResponder } from 'react-native';
import OverlayInteractionLayer, {
  type OverlayCatcherMode,
} from '../../src/components/features/graphs/CanvasOverlay/OverlayInteractionLayer';

const FRAME: CanvasOverlayType = {
  id: 'ov-1',
  kind: 'frame',
  x: 100,
  y: 100,
  width: 100,
  height: 60,
};

function tapEvent(x: number, y: number) {
  return { nativeEvent: { locationX: x, locationY: y } } as any;
}

async function setup(mode: OverlayCatcherMode, snapTargets: { x: number; y: number }[] = []) {
  const create = jest.spyOn(PanResponder, 'create');
  const screenToWorld = jest.fn((point: { x: number; y: number }) => ({
    x: point.x + 100,
    y: point.y,
  }));
  const callbacks = {
    onDrawTap: jest.fn(),
    onDrawRect: jest.fn(),
    onPreviewRect: jest.fn(),
    onSelectOverlay: jest.fn(),
  };
  const view = await render(
    <OverlayInteractionLayer
      mode={mode}
      screenToWorld={screenToWorld}
      scale={1}
      overlays={[FRAME]}
      snapTargets={snapTargets}
      {...callbacks}
    />,
  );
  const [config] = (create as jest.Mock).mock.calls.map((call) => call[0] as any);
  return { view, config, screenToWorld, callbacks };
}

describe('OverlayInteractionLayer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('converts taps to world points and snaps vertices to targets', async () => {
    const { config, callbacks } = await setup(
      { kind: 'draw', tool: 'line' },
      [{ x: 150, y: 50 }],
    );
    await config.onPanResponderGrant(tapEvent(48, 50));
    await config.onPanResponderRelease(tapEvent(48, 50), { dx: 0, dy: 0 });
    // Screen (48,50) -> world (148,50), snapped onto the target at (150,50).
    expect(callbacks.onDrawTap).toHaveBeenCalledWith({ x: 150, y: 50 });

    await config.onPanResponderGrant(tapEvent(0, 0));
    await config.onPanResponderRelease(tapEvent(0, 0), { dx: 0, dy: 0 });
    // Past the snap radius the raw world point stands.
    expect(callbacks.onDrawTap).toHaveBeenCalledWith({ x: 100, y: 0 });
  });

  it('previews rect drags live and commits on release', async () => {
    const { config, callbacks } = await setup({ kind: 'draw', tool: 'frame' });
    await config.onPanResponderGrant(tapEvent(0, 0));
    await config.onPanResponderMove(tapEvent(30, 20), { dx: 30, dy: 20 });
    expect(callbacks.onPreviewRect).toHaveBeenCalledWith({
      start: { x: 100, y: 0 },
      end: { x: 130, y: 20 },
    });
    await config.onPanResponderRelease(tapEvent(30, 20), { dx: 30, dy: 20 });
    expect(callbacks.onDrawRect).toHaveBeenCalledWith(
      { x: 100, y: 0 },
      { x: 130, y: 20 },
    );
    expect(callbacks.onPreviewRect).toHaveBeenLastCalledWith(null);
  });

  it('ignores taps while a rect tool is armed', async () => {
    const { config, callbacks } = await setup({ kind: 'draw', tool: 'rect' });
    await config.onPanResponderGrant(tapEvent(5, 5));
    await config.onPanResponderRelease(tapEvent(5, 5), { dx: 0, dy: 0 });
    expect(callbacks.onDrawRect).not.toHaveBeenCalled();
    expect(callbacks.onDrawTap).not.toHaveBeenCalled();
  });

  it('selects the overlay under the tap, or nothing on a miss', async () => {
    const { config, callbacks } = await setup({ kind: 'select' });
    // World (150,130): inside the frame at 100,100+100x60.
    await config.onPanResponderGrant(tapEvent(50, 130));
    await config.onPanResponderRelease(tapEvent(50, 130), { dx: 0, dy: 0 });
    expect(callbacks.onSelectOverlay).toHaveBeenCalledWith('ov-1');

    await config.onPanResponderGrant(tapEvent(500, 500));
    await config.onPanResponderRelease(tapEvent(500, 500), { dx: 0, dy: 0 });
    expect(callbacks.onSelectOverlay).toHaveBeenCalledWith(null);
  });
});
