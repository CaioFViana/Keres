/** @jest-environment node */
import { cardPlacement } from '../../src/guides/cardPlacement';

const base = { windowHeight: 800, cardHeight: 220, topInset: 24, bottomInset: 0 };

describe('cardPlacement', () => {
  it('rests at the bottom without a target', () => {
    expect(cardPlacement({ ...base, spot: null })).toBe('bottom');
  });

  it('stays at the bottom while the target is above the card', () => {
    expect(cardPlacement({ ...base, spot: { x: 0, y: 100, width: 300, height: 60 } })).toBe(
      'bottom',
    );
  });

  it('moves to the top when the bottom would cover the target, as the last group of a menu', () => {
    expect(cardPlacement({ ...base, spot: { x: 0, y: 640, width: 300, height: 90 } })).toBe('top');
  });

  it('counts the system bar under the card', () => {
    const spot = { x: 0, y: 500, width: 300, height: 40 };
    expect(cardPlacement({ ...base, spot })).toBe('bottom');
    expect(cardPlacement({ ...base, bottomInset: 60, spot })).toBe('top');
  });

  it('takes the side it covers less when it fits on neither', () => {
    // A tall target from the top edge to near the bottom: the card overlaps whichever way.
    const tall = { x: 0, y: 40, width: 300, height: 620 };
    expect(cardPlacement({ ...base, spot: tall })).toBe('bottom');
    const lowerTall = { x: 0, y: 250, width: 300, height: 540 };
    expect(cardPlacement({ ...base, spot: lowerTall })).toBe('top');
  });
});
