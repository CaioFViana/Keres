import { act, render } from '@testing-library/react-native';
import * as SkiaMock from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet } from 'react-native';
import SvgRasterHost from '../../src/components/features/export/SvgRasterHost';
import { __resetSvgRasterForTests, useSvgRasterStore } from '../../src/state/svgRasterStore';
import { rasterizeMapSvg } from '../../src/utils/svgRaster';

const mockUseCanvasKitReady = jest.fn(() => true);
jest.mock('../../src/components/features/graphs/SkiaEdgeCanvas/useCanvasKitReady', () => ({
  useCanvasKitReady: (...args: unknown[]) =>
    (mockUseCanvasKitReady as (...inner: unknown[]) => boolean)(...args),
}));

const skiaTest = (SkiaMock as unknown as { __skiaTest: { canvasHolder: { current: unknown } } })
  .__skiaTest;

beforeEach(() => {
  __resetSvgRasterForTests();
  skiaTest.canvasHolder.current = null;
  mockUseCanvasKitReady.mockReset();
  mockUseCanvasKitReady.mockReturnValue(true);
});

async function settle(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe('SvgRasterHost', () => {
  it('renders nothing while idle', async () => {
    const view = await render(<SvgRasterHost />);

    expect(view.container.queryAll((node) => node.type === 'SkiaCanvas')).toHaveLength(0);
    expect(useSvgRasterStore.getState().job).toBeNull();
  });

  it('resolves PNG bytes from a hidden canvas sized to the request', async () => {
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    skiaTest.canvasHolder.current = {
      makeImageSnapshot: () => ({ encodeToBytes: () => bytes }),
    };
    const view = await render(<SvgRasterHost />);

    let out: Promise<Uint8Array> | null = null;
    await act(async () => {
      out = rasterizeMapSvg('<svg width="10" height="20"></svg>', 100, 200);
    });

    const [canvas] = view.container.queryAll((node) => node.type === 'SkiaCanvas');
    expect(StyleSheet.flatten(canvas.props.style)).toMatchObject({
      position: 'absolute',
      width: 100,
      height: 200,
      opacity: 0,
    });
    expect(canvas.props.pointerEvents).toBe('none');
    const [image] = view.container.queryAll((node) => node.type === 'SkiaImageSVG');
    expect(image.props).toMatchObject({ x: 0, y: 0, width: 100, height: 200 });

    await settle(150);
    await expect(out!).resolves.toBe(bytes);
    // The host idles again once the bytes are delivered.
    expect(view.container.queryAll((node) => node.type === 'SkiaCanvas')).toHaveLength(0);
    expect(useSvgRasterStore.getState().job).toBeNull();
  });

  it('rejects when the SVG does not parse', async () => {
    const view = await render(<SvgRasterHost />);

    let out: Promise<Uint8Array> | null = null;
    await act(async () => {
      out = rasterizeMapSvg('not an svg', 10, 10);
      // Handled from birth: the effect rejects synchronously inside this `act`.
      out.catch(() => {});
    });

    await expect(out!).rejects.toThrow('could not parse');
    expect(view.container.queryAll((node) => node.type === 'SkiaCanvas')).toHaveLength(0);
  });

  it('rejects when the canvas never draws', async () => {
    skiaTest.canvasHolder.current = { makeImageSnapshot: () => null };
    await render(<SvgRasterHost />);

    let out: Promise<Uint8Array> | null = null;
    await act(async () => {
      out = rasterizeMapSvg('<svg width="10" height="20"></svg>', 10, 20);
      out.catch(() => {});
    });

    await settle(700);
    await expect(out!).rejects.toThrow('no bytes');
  });

  it('supersedes a stale request instead of resolving it late', async () => {
    skiaTest.canvasHolder.current = {
      makeImageSnapshot: () => ({ encodeToBytes: () => Uint8Array.from([9]) }),
    };
    await render(<SvgRasterHost />);

    let first: Promise<Uint8Array> | null = null;
    let second: Promise<Uint8Array> | null = null;
    await act(async () => {
      first = rasterizeMapSvg('<svg width="1" height="1"></svg>', 1, 1);
      second = rasterizeMapSvg('<svg width="2" height="2"></svg>', 2, 2);
      first.catch(() => {});
    });

    await expect(first!).rejects.toThrow('superseded');
    await settle(150);
    await expect(second!).resolves.toEqual(Uint8Array.from([9]));
  });

  it('holds the job without rendering until CanvasKit is ready', async () => {
    // Web: parsing or snapshotting against the unbound `Skia` API would only throw, and
    // this host sits at the app root with no boundary above it.
    mockUseCanvasKitReady.mockReturnValue(false);
    const view = await render(<SvgRasterHost />);

    let out: Promise<Uint8Array> | null = null;
    await act(async () => {
      out = rasterizeMapSvg('<svg width="10" height="20"></svg>', 10, 20);
      out.catch(() => {});
    });

    expect(view.container.queryAll((node) => node.type === 'SkiaCanvas')).toHaveLength(0);
    expect(useSvgRasterStore.getState().job).not.toBeNull();
    expect(out).not.toBeNull();
  });

  it('mounts the snapshot canvas inside a touch-transparent wrapper', async () => {
    skiaTest.canvasHolder.current = {
      makeImageSnapshot: () => ({ encodeToBytes: () => Uint8Array.from([1]) }),
    };
    const view = await render(<SvgRasterHost />);

    await act(async () => {
      const out = rasterizeMapSvg('<svg width="10" height="20"></svg>', 10, 20);
      out.catch(() => {});
    });

    const wrappers = view.container.queryAll(
      (node) => node.type === 'View' && node.props.pointerEvents === 'none',
    );
    expect(wrappers).toHaveLength(1);
    const [canvasElement] = React.Children.toArray(wrappers[0].props.children);
    expect((canvasElement as any)?.type).toBe(SkiaMock.Canvas);
    await settle(150);
  });
});
