import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, saturateColor } from '../../src/utils/colorMath';

describe('saturateColor', () => {
  it('returns non-#RRGGBB input untouched', () => {
    expect(saturateColor('')).toBe('');
    expect(saturateColor('abc')).toBe('abc');
    expect(saturateColor('#fff')).toBe('#fff');
  });

  it('scales each channel by the default factor', () => {
    expect(saturateColor('#808080')).toBe('#8c8c8c');
  });

  it('honours an explicit factor and clamps at white', () => {
    expect(saturateColor('#404040', 2)).toBe('#808080');
    expect(saturateColor('#ffffff')).toBe('#ffffff');
    expect(saturateColor('#000000')).toBe('#000000');
  });
});

describe('color conversion helpers', () => {
  it('parses hex with or without a hash and falls back to black', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('zzz')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('converts primary colors to HSV', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 });
    expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 });
  });

  it('gives achromatic colors zero hue and saturation', () => {
    expect(rgbToHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: expect.closeTo(50.2, 1) });
  });

  it('converts HSV back to RGB', () => {
    expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 });
  });

  it('formats RGB as padded hex', () => {
    expect(rgbToHex(255, 0, 16)).toBe('#ff0010');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });
});
