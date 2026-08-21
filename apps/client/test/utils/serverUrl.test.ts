import { normalizeServerUrl } from '../../src/utils/serverUrl';

describe('normalizeServerUrl', () => {
  it('treats trailing slashes, default ports and host case as the same address', () => {
    expect(normalizeServerUrl('https://Keres.example/')).toBe('https://keres.example');
    expect(normalizeServerUrl('https://keres.example:443')).toBe('https://keres.example');
    expect(normalizeServerUrl('http://keres.example:80/app/')).toBe('http://keres.example/app');
  });

  it('keeps a distinct protocol or path as a distinct address', () => {
    expect(normalizeServerUrl('http://keres.example')).toBe('http://keres.example');
    expect(normalizeServerUrl('https://keres.example/app')).not.toBe(
      normalizeServerUrl('https://keres.example'),
    );
  });

  it('falls back to trim-and-strip when the value is not a URL', () => {
    expect(normalizeServerUrl('  keres.example/  ')).toBe('keres.example');
  });
});
