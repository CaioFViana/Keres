import { galleryGridLayout, galleryScrollbarWidth } from '../../src/utils/galleryGridLayout';

/** The widest the row of cards may be: the list's 10 px per side, and a grid's 5 px of row padding. */
const roomFor = (width: number, numColumns: number, scrollbar = 0) =>
  width - 20 - scrollbar - (numColumns > 1 ? 10 : 0);

describe('galleryGridLayout', () => {
  it('shows two columns on a phone, at least', () => {
    expect(galleryGridLayout(360)).toEqual({ numColumns: 2, cardWidth: 155 });
    // an unmeasured list does not make a negative card
    expect(galleryGridLayout(0)).toEqual({ numColumns: 1, cardWidth: 0 });
  });

  it('adds columns as the list widens, so tiles never grow past the maximum', () => {
    for (const width of [480, 768, 1024, 1366, 1600, 1920, 2560, 3840]) {
      const { numColumns, cardWidth } = galleryGridLayout(width);
      // card + its 10 px of margin
      expect(cardWidth + 10).toBeLessThanOrEqual(240);
      expect(numColumns * (cardWidth + 10)).toBeLessThanOrEqual(roomFor(width, numColumns));
    }
    expect(galleryGridLayout(1600).numColumns).toBe(7);
    expect(galleryGridLayout(3840).numColumns).toBe(16);
  });

  it('keeps room for a scrollbar inside the list, so the last tile of a row is not cut off', () => {
    for (let width = 360; width <= 3840; width += 37) {
      const { numColumns, cardWidth } = galleryGridLayout(width, 16);
      expect(numColumns * (cardWidth + 10)).toBeLessThanOrEqual(roomFor(width, numColumns, 16));
    }
  });

  it('drops to one wide column when two would be cramped, and fills the list with it', () => {
    expect(galleryGridLayout(320)).toEqual({ numColumns: 1, cardWidth: 290 });
    expect(galleryGridLayout(349).numColumns).toBe(1);
    expect(galleryGridLayout(350)).toEqual({ numColumns: 2, cardWidth: 150 });
    // 20 px of list padding and the card's own 10 px of margin are all that is left over
    expect(galleryGridLayout(341).cardWidth).toBe(341 - 20 - 10);
  });

  it('never makes a tile narrower than it is on a phone', () => {
    for (let width = 200; width <= 3840; width += 10) {
      expect(galleryGridLayout(width).cardWidth).toBeGreaterThanOrEqual(150);
    }
  });
});

describe('galleryScrollbarWidth', () => {
  it('is what the list content lacks of the list width, once its padding is taken off', () => {
    expect(galleryScrollbarWidth(1000, 964)).toBe(16);
    expect(galleryScrollbarWidth(1000, 980)).toBe(0);
  });

  it('is zero before anything is measured, and never negative', () => {
    expect(galleryScrollbarWidth(0, 500)).toBe(0);
    expect(galleryScrollbarWidth(1000, 0)).toBe(0);
    expect(galleryScrollbarWidth(1000, 990)).toBe(0);
  });
});
