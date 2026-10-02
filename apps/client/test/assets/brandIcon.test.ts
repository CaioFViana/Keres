/**
 * @jest-environment node
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const images = join(__dirname, '../../assets/images');

describe('the brand icon of the settings screen', () => {
  it('is the 512 px copy, not the 1024 px original the desktop app is built from', () => {
    const header = readFileSync(join(images, 'desktop_icon_512.png'));

    expect([header.readUInt32BE(16), header.readUInt32BE(20)]).toEqual([512, 512]);
    // The original is 865 KB; the screen draws it at 256 px at most.
    expect(statSync(join(images, 'desktop_icon_512.png')).size).toBeLessThan(300 * 1024);
  });

  it('is the one the screen asks for, so the original never reaches the web bundle', () => {
    const screen = readFileSync(
      join(__dirname, '../../src/screens/enterstack/AppSettingsScreen.tsx'),
      'utf8',
    );

    expect(screen).toContain('desktop_icon_512.png');
    expect(screen).not.toMatch(/desktop_icon\.png/);
  });
});
