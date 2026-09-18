import {
  MAP_EXPORT_PNG_MAX_SIDE,
  fitRasterSize,
  parseSvgRootSize,
  sanitizeSvgForRaster,
  withPngExtension,
} from '../../src/utils/svgRaster';

describe('parseSvgRootSize', () => {
  it('reads the standalone document size off the root tag', () => {
    expect(
      parseSvgRootSize(
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><rect /></svg>',
      ),
    ).toEqual({ width: 800, height: 520 });
    expect(
      parseSvgRootSize('<svg width="120.5" height="40" viewBox="0 0 120.5 40"></svg>'),
    ).toEqual({ width: 120.5, height: 40 });
  });

  it('refuses to guess when dimensions are missing or degenerate', () => {
    expect(parseSvgRootSize('not an svg')).toBeNull();
    expect(parseSvgRootSize('<svg viewBox="0 0 10 10"></svg>')).toBeNull();
    expect(parseSvgRootSize('<svg width="0" height="10"></svg>')).toBeNull();
    expect(parseSvgRootSize('<svg width="-5" height="10"></svg>')).toBeNull();
    expect(parseSvgRootSize('<svg width="abc" height="10"></svg>')).toBeNull();
  });
});

describe('fitRasterSize', () => {
  it('keeps small documents at full resolution', () => {
    expect(fitRasterSize(800, 520)).toEqual({ width: 800, height: 520 });
  });

  it('caps the longest side, preserving aspect', () => {
    expect(fitRasterSize(100000, 5000)).toEqual({
      width: MAP_EXPORT_PNG_MAX_SIDE,
      height: Math.round(5000 * (MAP_EXPORT_PNG_MAX_SIDE / 100000)),
    });
    expect(MAP_EXPORT_PNG_MAX_SIDE).toBe(4096);
  });

  it('never drops below one pixel', () => {
    expect(fitRasterSize(0.2, 0.1)).toEqual({ width: 1, height: 1 });
    expect(fitRasterSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('sanitizeSvgForRaster', () => {
  it('collapses the fallback list to the generic family', () => {
    expect(
      sanitizeSvgForRaster('<svg font-family="Helvetica, Arial, sans-serif">'),
    ).toBe('<svg font-family="sans-serif">');
  });

  it('leaves strings without the list untouched', () => {
    expect(sanitizeSvgForRaster('<svg font-family="sans-serif">')).toBe(
      '<svg font-family="sans-serif">',
    );
    expect(sanitizeSvgForRaster('<svg></svg>')).toBe('<svg></svg>');
  });
});

describe('withPngExtension', () => {
  it('swaps the svg suffix for png', () => {
    expect(withPngExtension('story-mapa-2026-01-01.svg')).toBe('story-mapa-2026-01-01.png');
    expect(withPngExtension('MAPA.SVG')).toBe('MAPA.png');
  });

  it('appends when there is no suffix', () => {
    expect(withPngExtension('story-mapa')).toBe('story-mapa.png');
  });
});
