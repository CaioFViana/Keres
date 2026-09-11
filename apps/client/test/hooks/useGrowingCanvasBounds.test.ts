import { renderHook } from '@testing-library/react-native';
import { useGrowingCanvasBounds } from '../../src/hooks/useGrowingCanvasBounds';

describe('useGrowingCanvasBounds', () => {
  it('keeps its allocated surface while requirements fit inside it, then grows it', async () => {
    const initial = { width: 100, height: 100, originX: 0, originY: 0 };
    const view = await renderHook<
      ReturnType<typeof useGrowingCanvasBounds>,
      { bounds: typeof initial }
    >(({ bounds }) => useGrowingCanvasBounds(bounds), { initialProps: { bounds: initial } });
    expect(view.result.current).toEqual(initial);

    await view.rerender({ bounds: { width: 80, height: 80, originX: 10, originY: 10 } });
    expect(view.result.current).toEqual(initial);

    await view.rerender({ bounds: { width: 200, height: 100, originX: 0, originY: 0 } });
    expect(view.result.current.width).toBeGreaterThanOrEqual(200);
  });
});
