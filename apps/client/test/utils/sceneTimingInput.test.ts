/**
 * @jest-environment node
 */
import {
  MAX_SCENE_TIMING,
  isTimingInput,
  parseTimingInput,
} from '../../src/utils/sceneTimingInput';

describe('isTimingInput', () => {
  it.each(['', '-', '0', '42', '-7', '2147483647'])('accepts %p as in-progress input', (value) => {
    expect(isTimingInput(value)).toBe(true);
  });

  it.each(['12a', '1.5', '1 2', '--3', '3-', '+4'])('rejects %p', (value) => {
    expect(isTimingInput(value)).toBe(false);
  });
});

describe('parseTimingInput', () => {
  it('returns null for empty and sign-only input', () => {
    expect(parseTimingInput('')).toBeNull();
    expect(parseTimingInput('-')).toBeNull();
  });

  it('parses signed integers', () => {
    expect(parseTimingInput('42')).toBe(42);
    expect(parseTimingInput('-7')).toBe(-7);
    expect(parseTimingInput('0')).toBe(0);
  });

  it('accepts the 32-bit signed boundary and rejects beyond it', () => {
    expect(MAX_SCENE_TIMING).toBe(2147483647);
    expect(parseTimingInput('2147483647')).toBe(2147483647);
    expect(parseTimingInput('-2147483647')).toBe(-2147483647);
    expect(parseTimingInput('2147483648')).toBeNull();
    expect(parseTimingInput('-2147483648')).toBeNull();
  });

  it('rejects non-integers and unsafe numbers', () => {
    expect(parseTimingInput('abc')).toBeNull();
    expect(parseTimingInput('1.5')).toBeNull();
    expect(parseTimingInput('99999999999999999999999')).toBeNull();
  });
});
