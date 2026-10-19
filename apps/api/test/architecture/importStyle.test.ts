import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const API_ROOT = resolve(__dirname, '../..');
const MOCK_OBJECTS = new Set(['vi', 'jest']);
const MOCK_CALLS = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
  'requireActual',
  'requireMock',
]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

/** Every module specifier a file asks for: imports, re-exports, `import()`, `require` and test mocks. */
function specifiersOf(path: string): string[] {
  // A `../` specifier needs `..` somewhere in the file: skipping the rest keeps the scan to a few files instead of a parse of every one
  // (the whole tree took longer than the default test timeout under coverage).
  const text = readFileSync(path, 'utf8');
  if (!text.includes('..')) return [];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const push = (node: ts.Node | undefined) => {
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      found.push(node.text);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      push(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      push(node.argument.literal);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const isMock =
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        MOCK_OBJECTS.has(callee.expression.text) &&
        MOCK_CALLS.has(callee.name.text);
      if (isImport || isRequire || isMock) push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * Imports reach across folders by alias (`@/` for `src`, `@test/` for `test`, `@scripts/` for `scripts`) and
 * use `./` only for a file in the same folder or below. A `../` ties a file to its own depth: moving it, or
 * the folder around it, breaks the import silently until the compiler catches it.
 */
describe('import style', () => {
  it('never climbs out of a folder with a relative import', () => {
    const offenders: string[] = [];
    for (const root of ['src', 'test']) {
      for (const file of sourceFiles(join(API_ROOT, root))) {
        for (const spec of specifiersOf(file)) {
          if (spec === '..' || spec.startsWith('../')) {
            offenders.push(`${relative(API_ROOT, file).replace(/\\/g, '/')}: ${spec}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);
});
