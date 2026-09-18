import { render, type RenderResult } from '@testing-library/react-native';
import React, { createRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import GraphCanvasFrame, {
  graphCanvasPlaneStyle,
} from '../../src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { background: '#111' } }),
}));

type Root = RenderResult['container'];

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
    const view = await render(
      <GraphCanvasFrame
        containerRef={createRef<View>()}
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
    expect(planeOf(view.container).props.pointerEvents).toBe('box-none');
  });

  it('keeps pointerEvents out of the shared plane geometry (it only works as a View prop)', () => {
    expect(graphCanvasPlaneStyle).not.toHaveProperty('pointerEvents');
  });
});
