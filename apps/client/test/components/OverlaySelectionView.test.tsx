import { act, fireEvent, render } from '@testing-library/react-native';
import type { CanvasOverlayType } from '@keres/shared';
import { PanResponder } from 'react-native';
import OverlaySelectionView from '../../src/components/features/graphs/CanvasOverlay/OverlaySelectionView';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { primary: '#85f', surface: '#111' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const POLYGON: CanvasOverlayType = {
  id: 'ov-1',
  kind: 'polygon',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 80 },
  ],
};
const FRAME: CanvasOverlayType = { id: 'ov-2', kind: 'frame', x: 10, y: 10, width: 60, height: 40 };

function responderConfigs() {
  return (PanResponder.create as jest.Mock).mock.calls.map((call) => call[0] as any);
}

async function setup(overlay: CanvasOverlayType, scale = 2) {
  const create = jest.spyOn(PanResponder, 'create');
  const callbacks = {
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    onCommitMove: jest.fn(),
    onCommitVertex: jest.fn(),
    onCommitRect: jest.fn(),
    onDetails: jest.fn(),
    onMoveLayer: jest.fn(),
    onDeselect: jest.fn(),
  };
  const view = await render(
    <OverlaySelectionView overlay={overlay} scale={scale} {...callbacks} />,
  );
  return { view, callbacks, configs: responderConfigs(), create };
}

describe('OverlaySelectionView', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows vertex handles for polygons and corners for frames', async () => {
    const polygon = await setup(POLYGON);
    expect(polygon.view.getByTestId('overlay-vertex-0')).toBeTruthy();
    expect(polygon.view.getByTestId('overlay-vertex-2')).toBeTruthy();
    expect(polygon.view.queryByTestId('overlay-corner-0')).toBeNull();
    expect(polygon.view.getByTestId('overlay-move')).toBeTruthy();

    const frame = await setup(FRAME);
    expect(frame.view.queryByTestId('overlay-vertex-0')).toBeNull();
    expect(frame.view.getByTestId('overlay-corner-0')).toBeTruthy();
    expect(frame.view.getByTestId('overlay-corner-3')).toBeTruthy();
  });

  it('commits moves in world units', async () => {
    const { callbacks, configs } = await setup(POLYGON);
    const [move] = configs;
    await act(async () => {
      await move.onPanResponderGrant();
      await move.onPanResponderMove({}, { dx: 20, dy: 10 });
      await move.onPanResponderRelease();
    });
    // Screen pixels divided by the scale.
    expect(callbacks.onCommitMove).toHaveBeenCalledWith('ov-1', 10, 5);
    expect(callbacks.onDragStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('commits vertex drags to world points', async () => {
    const { callbacks, configs } = await setup(POLYGON);
    // First responder is the move badge; vertex handles follow in point order.
    const vertex = configs[2];
    await act(async () => {
      await vertex.onPanResponderGrant();
      await vertex.onPanResponderMove({}, { dx: 6, dy: -4 });
      await vertex.onPanResponderRelease();
    });
    expect(callbacks.onCommitVertex).toHaveBeenCalledWith('ov-1', 1, { x: 103, y: -2 });
  });

  it('commits corner drags as normalized rects', async () => {
    const { callbacks, configs } = await setup(FRAME);
    const corner = configs[3];
    await act(async () => {
      await corner.onPanResponderGrant();
      await corner.onPanResponderMove({}, { dx: 20, dy: 20 });
      await corner.onPanResponderRelease();
    });
    // Bottom-right corner dragged out by (10,10) world.
    expect(callbacks.onCommitRect).toHaveBeenCalledWith('ov-2', {
      x: 10,
      y: 10,
      width: 70,
      height: 50,
    });
  });

  it('routes the action column to details, layers and deselect', async () => {
    const { view, callbacks } = await setup(POLYGON);

    expect(view.getByLabelText('overlay_deselect')).toBeTruthy();
    expect(view.getByLabelText('overlay_edit_details')).toBeTruthy();
    expect(view.getByLabelText('overlay_bring_to_front')).toBeTruthy();
    expect(view.getByLabelText('overlay_send_to_back')).toBeTruthy();

    await fireEvent.press(view.getByTestId('overlay-chrome-details'));
    expect(callbacks.onDetails).toHaveBeenCalledWith('ov-1');
    await fireEvent.press(view.getByTestId('overlay-chrome-raise'));
    expect(callbacks.onMoveLayer).toHaveBeenCalledWith('ov-1', 'front');
    await fireEvent.press(view.getByTestId('overlay-chrome-lower'));
    expect(callbacks.onMoveLayer).toHaveBeenCalledWith('ov-1', 'back');
    await fireEvent.press(view.getByTestId('overlay-chrome-deselect'));
    expect(callbacks.onDeselect).toHaveBeenCalledTimes(1);
  });
});
