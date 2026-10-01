import * as SkiaMock from '@shopify/react-native-skia';
import { renderHook } from '@testing-library/react-native';
import mediumTtf from '../../assets/fonts/Roboto-Medium.ttf';
import regularTtf from '../../assets/fonts/Roboto-Regular.ttf';
import { useEdgeFont } from '../../src/components/features/graphs/SkiaEdgeCanvas/useEdgeFont';

const bundledFont = { source: 'bundled' };
const systemFont = { source: 'system' };

describe('useEdgeFont (native)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the bundled Regular at the size asked, the same file on every platform', async () => {
    const useFont = jest.spyOn(SkiaMock, 'useFont').mockReturnValue(bundledFont as never);
    jest.spyOn(SkiaMock, 'matchFont').mockReturnValue(systemFont as never);

    const { result } = await renderHook(() => useEdgeFont(11));

    expect(useFont).toHaveBeenCalledWith(regularTtf, 11);
    expect(result.current).toBe(bundledFont);
  });

  it('uses the bundled Medium for the medium weight', async () => {
    const useFont = jest.spyOn(SkiaMock, 'useFont').mockReturnValue(bundledFont as never);

    await renderHook(() => useEdgeFont(11, true));

    expect(useFont).toHaveBeenCalledWith(mediumTtf, 11);
  });

  it('falls back to the system font while the bundled one has not loaded', async () => {
    jest.spyOn(SkiaMock, 'useFont').mockReturnValue(null as never);
    const match = jest.spyOn(SkiaMock, 'matchFont').mockReturnValue(systemFont as never);

    const { result } = await renderHook(() => useEdgeFont(10));

    expect(match).toHaveBeenCalledWith({ fontSize: 10 });
    expect(result.current).toBe(systemFont);
  });

  it('is null - labels skipped - when neither font exists', async () => {
    jest.spyOn(SkiaMock, 'useFont').mockReturnValue(null as never);
    jest.spyOn(SkiaMock, 'matchFont').mockImplementation(() => {
      throw new Error('no fonts');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = await renderHook(() => useEdgeFont(10, true));

    expect(result.current).toBeNull();
  });
});
