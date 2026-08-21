import * as os from 'node:os';
import * as path from 'node:path';

export const CONFIG_FILE_NAME = 'config.json';
export const SECRETS_FILE_NAME = 'secrets.json';
export const SQLITE_FILE_NAME = 'keres.db';
export const DEFAULT_MEDIA_DIR_NAME = 'media-storage';

export function defaultDataDir(
  home: string = os.homedir(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (process.platform === 'win32') {
    return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'KeresServer');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'KeresServer');
  }
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'keres-server');
}

export function configPathFor(dataDir: string): string {
  return path.join(dataDir, CONFIG_FILE_NAME);
}

export function secretsPathFor(dataDir: string): string {
  return path.join(dataDir, SECRETS_FILE_NAME);
}

export function sqliteUrlFor(dataDir: string): string {
  const file = path.join(dataDir, SQLITE_FILE_NAME).replace(/\\/g, '/');
  return `file:${file}`;
}

export function defaultMediaPathFor(dataDir: string): string {
  return path.join(dataDir, DEFAULT_MEDIA_DIR_NAME);
}
