/**
 * The `@/src/...` specifier of a path inside the client's `src`: generated files import by alias, like
 * the code written by hand (the import rule is enforced by `test/architecture/importStyle.test.ts`, which
 * a generated file that climbed with `../` would fail on its next run).
 */
export function srcAlias(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/src/');
  if (index < 0) throw new Error(`Not inside the client src: ${absolutePath}`);
  return `@${normalized.slice(index)}`;
}
