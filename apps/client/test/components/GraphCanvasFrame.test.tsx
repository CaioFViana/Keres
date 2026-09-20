import { render, type RenderResult } from '@testing-library/react-native';
import { createRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import GraphCanvasFrame, {
  graphCanvasPlaneStyle,
  suppressNativeDragOnContainer,
} from '../../src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { background: '#111' } }),
}));

type Root = RenderResult['container'];

function renderFrame(containerRef = createRef<View>()) {
  return render(
    <GraphCanvasFrame
      containerRef={containerRef}
      handleLayout={() => undefined}
      panHandlers={PanResponder.create({}).panHandlers}
      animatedTransform={[
        { translateX: new Animated.Value(0) },
        { translateY: new Animated.Value(0) },
        { scale: new Animated.Value(1) },
      ]}
    >
      <View testID="plane-child" />
    </GraphCanvasFrame>,
  );
}

/** The camera plane: the single host view carrying the transform. */
function planeOf(root: Root) {
  const planes = root.queryAll((node) => {
    if (node.type !== 'View') return false;
    const style = StyleSheet.flatten(node.props.style);
    return Array.isArray(style?.transform);
  });
  expect(planes).toHaveLength(1);
  return planes[0];
}

describe('GraphCanvasFrame', () => {
  it('exposes box-none as a real plane prop so empty space falls through on web and native', async () => {
    const view = await renderFrame();
    expect(planeOf(view.container).props.pointerEvents).toBe('box-none');
  });

  it('keeps pointerEvents out of the shared plane geometry (it only works as a View prop)', () => {
    expect(graphCanvasPlaneStyle).not.toHaveProperty('pointerEvents');
  });

  it('suppresses native dragstart on a web container so image gestures stay in the responder system', () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const detach = suppressNativeDragOnContainer(
      { current: { addEventListener, removeEventListener } },
      'web',
    );
    expect(addEventListener).toHaveBeenCalledWith('dragstart', expect.any(Function));
    const suppress = addEventListener.mock.calls[0][1] as (event: {
      preventDefault: () => void;
    }) => void;
    const preventDefault = jest.fn();
    suppress({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    detach?.();
    expect(removeEventListener).toHaveBeenCalledWith('dragstart', suppress);
  });

  it('attaches no DOM listeners off web or without a DOM node', () => {
    const addEventListener = jest.fn();
    const domRef = { current: { addEventListener, removeEventListener: jest.fn() } };
    expect(suppressNativeDragOnContainer(domRef, 'ios')).toBeUndefined();
    expect(addEventListener).not.toHaveBeenCalled();
    expect(suppressNativeDragOnContainer({ current: null }, 'web')).toBeUndefined();
    expect(suppressNativeDragOnContainer({ current: {} }, 'web')).toBeUndefined();
  });
});
