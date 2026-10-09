import {
  clampBase,
  defaultBase,
  highestBase,
  PIANO_HIGHEST,
  PIANO_LOWEST,
  pianoLayout,
} from '../../src/components/features/songs/pianoLayout';

describe('pianoLayout', () => {
  it('keeps two octaves of ordinary keys to slide across while the room is unknown or narrow', () => {
    for (const width of [null, undefined, 0, 320, 375, 600]) {
      expect(pianoLayout(width)).toEqual({ octaves: 2, keyWidth: 42, height: 112 });
    }
  });

  it('fills the width with as many octaves as fit at a comfortable key, taller as the keys widen', () => {
    const tablet = pianoLayout(760);
    expect(tablet.octaves).toBe(2);
    expect(tablet.keyWidth * (tablet.octaves * 7 + 1)).toBeCloseTo(760);

    const desktop = pianoLayout(1100);
    expect(desktop.octaves).toBe(3);
    expect(desktop.keyWidth * (desktop.octaves * 7 + 1)).toBeCloseTo(1100);
    expect(desktop.keyWidth).toBeGreaterThanOrEqual(40);
    expect(desktop.height).toBeGreaterThan(112);
  });

  it('never draws past the range it can reach, nor keys too tall', () => {
    const huge = pianoLayout(4000);
    expect(huge.octaves).toBe((PIANO_HIGHEST - PIANO_LOWEST) / 12);
    expect(huge.height).toBeLessThanOrEqual(200);
  });

  it('keeps the first key inside the range for the octaves shown', () => {
    expect(highestBase(2)).toBe(72);
    expect(highestBase(5)).toBe(PIANO_LOWEST);
    expect(clampBase(72, 3)).toBe(60);
    expect(clampBase(10, 2)).toBe(PIANO_LOWEST);
  });

  it('opens on middle C, centred as the octaves grow', () => {
    expect(defaultBase(2)).toBe(60);
    expect(defaultBase(3)).toBe(48);
    expect(defaultBase(4)).toBe(48);
    expect(defaultBase(5)).toBe(36);
  });
});
