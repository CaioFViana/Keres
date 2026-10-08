import { PAGE_FORMAT_ASPECT, PAGE_FORMATS } from '@keres/shared';
import { sketchSizeForPageFormat } from '../../src/utils/sketchPageSize';

describe('sketchSizeForPageFormat', () => {
  it('uses the Sketch papers that are the page: A5 and the 16:9 frame', () => {
    expect(sketchSizeForPageFormat('a5')).toEqual({ width: 559, height: 794, preset: 'a5' });
    expect(sketchSizeForPageFormat('wide')).toEqual({ width: 1280, height: 720, preset: 'wide' });
  });

  it('cuts the comic book and manga pages to their own shape, with no paper name', () => {
    expect(sketchSizeForPageFormat('comic-us')).toEqual({ width: 800, height: 1238, preset: null });
    expect(sketchSizeForPageFormat('b5')).toEqual({ width: 800, height: 1136, preset: null });
  });

  it('keeps the shape of every page format the work can have', () => {
    for (const format of PAGE_FORMATS) {
      const { width, height } = sketchSizeForPageFormat(format);
      expect(width / height).toBeCloseTo(PAGE_FORMAT_ASPECT[format], 1);
    }
  });
});
