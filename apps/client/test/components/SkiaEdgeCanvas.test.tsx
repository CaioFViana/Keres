import { render } from '@testing-library/react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet } from 'react-native';
import SkiaEdgeCanvas from '../../src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';

const mockUseCanvasKitReady = jest.fn(() => true);
jest.mock('../../src/components/features/graphs/SkiaEdgeCanvas/useCanvasKitReady', () => ({
  useCanvasKitReady: (...args: unknown[]) =>
    (mockUseCanvasKitReady as (...inner: unknown[]) => boolean)(...args),
}));

const CAMERA = { value: [{ translateX: 1 }, { translateY: 2 }, { scale: 0.5 }] } as never;

async function renderCanvas() {
  return render(
    <SkiaEdgeCanvas camera={CAMERA}>
      <Path path="M 0 0 L 10 10" style="stroke" color="#fff" />
    </SkiaEdgeCanvas>,
  );
}

describe('SkiaEdgeCanvas', () => {
  beforeEach(() => {
    mockUseCanvasKitReady.mockReset();
    mockUseCanvasKitReady.mockReturnValue(true);
  });

  it('renders nothing until CanvasKit is ready (web boots it async)', async () => {
    mockUseCanvasKitReady.mockReturnValue(false);

    const view = await renderCanvas();

    expect(view.container.queryAll((node) => node.type === 'SkiaCanvas')).toHaveLength(0);
  });

  it('renders the viewport-sized canvas with the live camera once ready', async () => {
    const view = await renderCanvas();

    const canvases = view.container.queryAll((node) => node.type === 'SkiaCanvas');
    expect(canvases).toHaveLength(1);
    expect(StyleSheet.flatten(canvases[0].props.style)).toMatchObject({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    expect(canvases[0].props.pointerEvents).toBe('none');
    const groups = view.container.queryAll((node) => node.type === 'SkiaGroup');
    expect(groups).toHaveLength(1);
    expect(groups[0].props.transform.value).toEqual([
      { translateX: 1 },
      { translateY: 2 },
      { scale: 0.5 },
    ]);
  });

  it('shields pointer events so content below the overlay stays interactive', async () => {
    // Skia's web view drops the `pointerEvents` prop, so without this wrapper the canvas
    // would swallow every gesture aimed at the planes below it (the map's image bases).
    const view = await renderCanvas();

    const wrappers = view.container.queryAll((node) => node.type === 'View');
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(wrappers[0].props.style)).toMatchObject({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    const [canvasElement] = React.Children.toArray(wrappers[0].props.children);
    expect((canvasElement as any)?.type).toBe(Canvas);
  });
});
