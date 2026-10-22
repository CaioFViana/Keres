/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A form's services are created in its first render. Created in an effect they are not there while the
 * form first draws, and whatever asks for one in that window (a load, a draft restore) finds nothing and
 * quietly does nothing.
 */

const SOURCE_ROOT = resolve(__dirname, '../../src');

function listFormResources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listFormResources(path);
    return /^use\w+FormResources\.ts$/.test(entry) ? [path] : [];
  });
}

const hooks = listFormResources(resolve(SOURCE_ROOT, 'screens'));
const nameOf = (path: string) => relative(SOURCE_ROOT, path).replace(/\\/g, '/');

describe('form resource hooks', () => {
  it('scans the hooks it is meant to guard', () => {
    expect(hooks.length).toBeGreaterThanOrEqual(17);
  });

  it('create their services in the render, never inside an effect', () => {
    const offenders = hooks
      .filter((path) =>
        /useEffect\(\(\) => \{\s*(?:\/\/[^\n]*\s*)*\w+Ref\.current\s*\?\?=/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map(nameOf)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('create every service they hold a ref for', () => {
    const lacking = hooks
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        const refs = Array.from(source.matchAll(/const (\w+ServiceRef) = useRef</g), (m) => m[1]);
        return refs.some((ref) => !new RegExp(`${ref}\\.current\\s*\\?\\?=`).test(source));
      })
      .map(nameOf)
      .sort();

    expect(lacking).toEqual([]);
  });
});
