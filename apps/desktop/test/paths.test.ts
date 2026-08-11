import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveClientFile, resolveMediaPath } from '../src/paths';

const MEDIA_ROOT = path.join('C:', 'Users', 'test', 'AppData', 'Keres', 'media-storage');
const CLIENT_DIST = path.join('C:', 'Keres', 'apps', 'client', 'dist');

const under = (root: string, ...segments: string[]) => path.join(root, ...segments);

describe('resolveMediaPath', () => {
  it('resolves a media path in the layout the client writes', () => {
    expect(resolveMediaPath(MEDIA_ROOT, 'media/story-1/abc123.png')).toBe(
      under(MEDIA_ROOT, 'media', 'story-1', 'abc123.png'),
    );
  });

  it('accepts the root itself, which media:list-all walks', () => {
    expect(resolveMediaPath(MEDIA_ROOT, '')).toBe(MEDIA_ROOT);
    expect(resolveMediaPath(MEDIA_ROOT, '.')).toBe(MEDIA_ROOT);
  });

  it.each([
    ['a parent escape', '../secrets.txt'],
    ['an escape hidden mid-path', 'media/../../secrets.txt'],
    ['an escape into a sibling with a shared prefix', '../media-storage-evil/secrets.txt'],
    ['a deep escape', '../../../../../../etc/passwd'],
  ])('refuses %s', (_label, relativePath) => {
    expect(() => resolveMediaPath(MEDIA_ROOT, relativePath)).toThrow(/outside media storage/);
  });

  it('names the offending path in the error, so the log is actionable', () => {
    expect(() => resolveMediaPath(MEDIA_ROOT, '../secrets.txt')).toThrow('"../secrets.txt"');
  });

  it('keeps a relative segment that only looks like an escape inside the root', () => {
    expect(resolveMediaPath(MEDIA_ROOT, 'media/story-1/../story-2/a.png')).toBe(
      under(MEDIA_ROOT, 'media', 'story-2', 'a.png'),
    );
  });
});

describe('resolveClientFile', () => {
  const existing = (...files: string[]) => {
    const set = new Set(files);
    return (filePath: string) => set.has(filePath);
  };

  it('serves a file request directly when the file exists', () => {
    const target = under(CLIENT_DIST, '_expo', 'static', 'js', 'entry-abc.js');

    expect(resolveClientFile(CLIENT_DIST, '/_expo/static/js/entry-abc.js', existing(target))).toBe(target);
  });

  it('prefers the directory index for an extensionless route', () => {
    const target = under(CLIENT_DIST, 'story', 'index.html');

    expect(resolveClientFile(CLIENT_DIST, '/story', existing(target))).toBe(target);
  });

  it('falls back to a flat route.html export when there is no directory index', () => {
    const target = under(CLIENT_DIST, 'story.html');

    expect(resolveClientFile(CLIENT_DIST, '/story', existing(target))).toBe(target);
  });

  it('falls back to the root index.html so a refresh on a client route still boots the app', () => {
    expect(resolveClientFile(CLIENT_DIST, '/characters/01ARZ3NDEKTSV4RRFFQ69G5FAV', existing())).toBe(
      under(CLIENT_DIST, 'index.html'),
    );
  });

  it('falls back to index.html for a missing asset rather than resolving outside the export', () => {
    expect(resolveClientFile(CLIENT_DIST, '/missing.png', existing())).toBe(under(CLIENT_DIST, 'index.html'));
  });

  it.each([
    ['a parent escape', '/../secret.html'],
    ['a sibling directory sharing the dist prefix', '/../dist-evil/index.html'],
  ])('never serves %s, even if that file exists', (_label, requestPath) => {
    const escaped = path.join(CLIENT_DIST, requestPath);

    expect(resolveClientFile(CLIENT_DIST, requestPath, existing(escaped))).toBe(under(CLIENT_DIST, 'index.html'));
  });
});
