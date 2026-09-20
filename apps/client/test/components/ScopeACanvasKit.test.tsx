import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import { ensureCanvasKit } from '../../src/components/features/graphs/SkiaEdgeCanvas/canvasKitBoot';
import { useCanvasKitReady } from '../../src/components/features/graphs/SkiaEdgeCanvas/useCanvasKitReady';
import { useEdgeFont } from '../../src/components/features/graphs/SkiaEdgeCanvas/useEdgeFont';

function FontProbe({ size, medium }: { size: number; medium?: boolean }) {
  const font = useEdgeFont(size, medium);
  return <View testID={font ? 'font-ready' : 'font-pending'} />;
}

describe('canvasKitBoot (native)', () => {
  it('resolves immediately: the bindings ship with the app', async () => {
    await expect(ensureCanvasKit()).resolves.toBeUndefined();
  });
});

describe('useCanvasKitReady (native)', () => {
  it('is always ready on native', () => {
    expect(useCanvasKitReady()).toBe(true);
  });
});

describe('useEdgeFont (native)', () => {
  it('matches the regular system font synchronously', async () => {
    const view = await render(<FontProbe size={12} />);

    expect(view.getByTestId('font-ready')).toBeTruthy();
    expect(view.queryByTestId('font-pending')).toBeNull();
  });

  it('matches the medium weight when asked', async () => {
    const view = await render(<FontProbe size={12} medium />);

    expect(view.getByTestId('font-ready')).toBeTruthy();
  });
});
