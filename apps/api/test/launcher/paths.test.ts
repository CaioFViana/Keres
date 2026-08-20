import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultDataDir, sqliteUrlFor } from '../../src/launcher/paths';

describe('launcher paths', () => {
  it('puts Windows data under AppData\\Roaming\\KeresServer', () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      expect(
        defaultDataDir('C:/Users/sam', { APPDATA: 'C:/Users/sam/AppData/Roaming' }).replace(
          /\\/g,
          '/',
        ),
      ).toBe('C:/Users/sam/AppData/Roaming/KeresServer');
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('puts Linux data under XDG or ~/.local/share', () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      expect(defaultDataDir('/home/sam', {}).replace(/\\/g, '/')).toBe(
        '/home/sam/.local/share/keres-server',
      );
      expect(
        defaultDataDir('/home/sam', { XDG_DATA_HOME: '/home/sam/.data' }).replace(/\\/g, '/'),
      ).toBe('/home/sam/.data/keres-server');
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('writes a file: sqlite URL with forward slashes', () => {
    expect(sqliteUrlFor(path.join('C:', 'data'))).toMatch(/^file:.*keres\.db$/);
    expect(sqliteUrlFor(path.join('C:', 'data'))).not.toContain('\\');
  });
});
