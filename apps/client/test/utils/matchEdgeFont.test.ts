import * as SkiaMock from '@shopify/react-native-skia';
import { matchEdgeFont } from '../../src/components/features/graphs/SkiaEdgeCanvas/matchEdgeFont';

describe('matchEdgeFont', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the matched font', () => {
    const font = matchEdgeFont({ fontSize: 11 });

    expect(font).toEqual(
      expect.objectContaining({
        getGlyphIDs: expect.any(Function),
        getGlyphWidths: expect.any(Function),
      }),
    );
  });

  it('returns null and warns once when matching throws (web has no matchFamilyStyle)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(SkiaMock, 'matchFont').mockImplementation(() => {
      throw new Error('Not implemented on React Native Web');
    });

    expect(matchEdgeFont({ fontSize: 11 })).toBeNull();
    expect(matchEdgeFont({ fontSize: 11 })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('edge labels hidden'));
  });
});
