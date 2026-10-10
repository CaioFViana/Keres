/**
 * @jest-environment node
 */
import {
  compactDrawerWidthFor,
  DRAWER_SWIPE_EDGE_WIDTH,
  DRAWER_SWIPE_MIN_DISTANCE,
} from '../../src/navigation/drawerInteraction';

describe('drawerInteraction', () => {
  it('keeps drawer drags deliberate and edge-only', () => {
    expect(DRAWER_SWIPE_EDGE_WIDTH).toBe(28);
    expect(DRAWER_SWIPE_MIN_DISTANCE).toBe(24);
  });

  describe('compactDrawerWidthFor', () => {
    it('is wide enough on a phone to read "Chapters and scenes" whole', () => {
      expect(compactDrawerWidthFor(375)).toBe(300);
      expect(compactDrawerWidthFor(412)).toBe(300);
    });

    it('takes four fifths of a very small window rather than more than it has', () => {
      expect(compactDrawerWidthFor(320)).toBe(256);
    });

    it('keeps three fifths where that is already wide', () => {
      expect(compactDrawerWidthFor(700)).toBe(420);
    });
  });
});
