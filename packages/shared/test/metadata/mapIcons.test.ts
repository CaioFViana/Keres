import { describe, expect, it } from 'vitest';
import { resolveMapIcon } from '../../metadata/mapIcons';

describe('resolveMapIcon', () => {
  it('treats plain names as Ionicons, keeping the Showcase .svg lookup valid', () => {
    expect(resolveMapIcon('flag')).toEqual({ family: 'ion', glyph: 'flag' });
    expect(resolveMapIcon('')).toEqual({ family: 'ion', glyph: '' });
  });

  it('accepts the explicit ion: prefix', () => {
    expect(resolveMapIcon('ion:flag')).toEqual({ family: 'ion', glyph: 'flag' });
  });

  it('reserves the keres: namespace for the future SVG pack', () => {
    expect(resolveMapIcon('keres:castle')).toEqual({ family: 'keres', glyph: 'castle' });
  });

  it('falls back to unknown on foreign namespaces, keeping the full name', () => {
    expect(resolveMapIcon('fa:flag')).toEqual({ family: 'unknown', glyph: 'fa:flag' });
    // Only the first colon splits: the rest belongs to the glyph.
    expect(resolveMapIcon('ion:a:b')).toEqual({ family: 'ion', glyph: 'a:b' });
  });
});
