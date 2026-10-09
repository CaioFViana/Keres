import { galleryGridLayout } from '../../src/utils/galleryGridLayout';

describe('galleryGridLayout', () => {
  it('shows two columns on a phone, at least', () => {
    expect(galleryGridLayout(360)).toEqual({ numColumns: 2, cardWidth: 155 });
    expect(galleryGridLayout(0).numColumns).toBe(2);
  });

  it('adds columns as the list widens, so tiles never grow past the maximum', () => {
    for (const width of [480, 768, 1024, 1366, 1600, 1920, 2560, 3840]) {
      const { numColumns, cardWidth } = galleryGridLayout(width);
      // card + its 10 px of margin
      expect(cardWidth + 10).toBeLessThanOrEqual(240);
      // the list's 10 px and each row's 5 px of padding stay free on both sides
      expect(numColumns * (cardWidth + 10)).toBeLessThanOrEqual(width - 30);
    }
    expect(galleryGridLayout(1600).numColumns).toBe(7);
    expect(galleryGridLayout(3840).numColumns).toBe(16);
  });

  it('keeps room for a scrollbar inside the list, so the last tile of a row is not cut off', () => {
    for (let width = 360; width <= 3840; width += 37) {
      const { numColumns, cardWidth } = galleryGridLayout(width, 16);
      expect(numColumns * (cardWidth + 10)).toBeLessThanOrEqual(width - 30 - 16);
    }
  });

  it('never makes a tile narrower than it is on a phone', () => {
    for (let width = 360; width <= 3840; width += 40) {
      expect(galleryGridLayout(width).cardWidth).toBeGreaterThanOrEqual(150);
    }
  });
});
