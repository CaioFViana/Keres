import { describe, expect, it } from 'vitest';
import { buildFaviconIco, FAVICON_SIZES } from '../../vite.keresIcon';

/** The images inside an ICO: its directory is 16 bytes an entry after a 6-byte header. */
function iconEntries(ico: Buffer) {
  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const offset = 6 + index * 16;
    return { size: ico[offset] || 256, bytes: ico.readUInt32LE(offset + 8) };
  });
}

describe('buildFaviconIco', () => {
  it('holds only the sizes a favicon is drawn at', async () => {
    const entries = iconEntries(await buildFaviconIco());

    expect(entries.map((entry) => entry.size).sort((a, b) => a - b)).toEqual([...FAVICON_SIZES]);
  });

  it('stays small: it is downloaded by every page, and a 256 px image alone was 270 KB of it', async () => {
    const ico = await buildFaviconIco();

    expect(ico.length).toBeLessThan(40 * 1024);
  });
});
