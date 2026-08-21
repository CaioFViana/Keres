import { describe, expect, it } from 'vitest';
import { parseLauncherArgs } from '../../src/launcher/args';

describe('parseLauncherArgs', () => {
  it('parses help and version first', () => {
    expect(parseLauncherArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseLauncherArgs(['-v'])).toEqual({ kind: 'version' });
  });

  it('parses a start with optional flags', () => {
    expect(parseLauncherArgs(['--setup', '--config', 'C:/data/config.json'])).toEqual({
      kind: 'run',
      setup: true,
      nonInteractive: false,
      configPath: 'C:/data/config.json',
    });
  });

  it('accepts --config=', () => {
    expect(parseLauncherArgs(['--config=./config.json', '--non-interactive'])).toEqual({
      kind: 'run',
      setup: false,
      nonInteractive: true,
      configPath: './config.json',
    });
  });

  it('rejects unknown flags and a missing --config value', () => {
    expect(() => parseLauncherArgs(['--nope'])).toThrow(/Unknown argument/);
    expect(() => parseLauncherArgs(['--config'])).toThrow(/requires a path/);
  });

  it('parses --backup with an optional destination', () => {
    expect(parseLauncherArgs(['--backup'])).toEqual({
      kind: 'backup',
      configPath: undefined,
      destinationParent: undefined,
    });
    expect(parseLauncherArgs(['--backup', 'D:/Backups', '--config', './config.json'])).toEqual({
      kind: 'backup',
      configPath: './config.json',
      destinationParent: 'D:/Backups',
    });
  });

  it('rejects --backup together with --setup', () => {
    expect(() => parseLauncherArgs(['--backup', '--setup'])).toThrow(/cannot be combined/);
  });
});
