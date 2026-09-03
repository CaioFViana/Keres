/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const enumMembers = (source: string) =>
  Array.from(source.matchAll(/^\s{2}(\w+)\s*=\s*'\w+',/gm), ([, name]) => name).sort();
const switchMembers = (source: string) =>
  Array.from(source.matchAll(/case OperationLogEntityType\.(\w+):/g), ([, name]) => name);

/**
 * Every operation-log entity must have a readable resolver. Missing one does not cause a type
 * error: sync still works, but a log or conflict becomes an anonymous row, which is precisely the
 * kind of silent regression that made Route and RouteStep hard to diagnose.
 */
describe('operation-log resolver coverage', () => {
  it('resolves every declared operation-log entity type', () => {
    const declared = enumMembers(
      read('packages', 'shared', 'metadata', 'OperationLogEntityType.ts'),
    );
    const resolved = new Set([
      ...switchMembers(read('apps', 'client', 'src', 'services', 'EntityService.ts')),
      ...switchMembers(read('apps', 'client', 'src', 'services', 'EntityAdvancedNameResolver.ts')),
      ...switchMembers(read('apps', 'client', 'src', 'services', 'EntityIdentifierResolver.ts')),
    ]);

    expect([...resolved].sort()).toEqual(declared);
  });
});
