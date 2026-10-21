import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * The landing site's layers, verified rather than agreed upon.
 *
 * Each folder of `src/` is a layer, and a layer may import only layers below it in this list. The
 * page composes components, components read the content (the catalog, the links, the prices) and call the
 * API layer, and the content and the API layer know nothing of the screen - so the copy and the numbers
 * can change without touching a component, and a component can be tested without a network.
 */
const SRC = resolve(__dirname, '../../src');
const LAYERS = [
  'theme',
  'i18n',
  'content',
  'variant',
  'api',
  'components',
  'pages',
  'App',
  'main',
] as const;
type Layer = (typeof LAYERS)[number];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    // A declaration file (`virtual-modules.d.ts`) types a build-time module; it is not a layer.
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every module specifier a file asks for: imports, re-exports, `import()` and type imports. */
function specifiersOf(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const push = (node: ts.Node | undefined) => {
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      found.push(node.text);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) push(node.moduleSpecifier);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      push(node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const layerOfFile = (file: string): Layer => {
  const first = relative(SRC, file)
    .split(sep)[0]
    .replace(/\.\w+$/, '');
  return first as Layer;
};

/** The layer a specifier points into, or null when it is a package, a stylesheet or a virtual module. */
function layerOfSpecifier(specifier: string, file: string): Layer | null {
  let target: string | null = null;
  if (specifier.startsWith('@/')) target = specifier.slice(2);
  else if (specifier.startsWith('.')) target = relative(SRC, resolve(dirname(file), specifier));
  if (target === null) return null;
  const first = target.split(/[\/]/)[0].replace(/\.\w+$/, '');
  return (LAYERS as readonly string[]).includes(first) ? (first as Layer) : null;
}

const files = sourceFiles(SRC);
const rel = (file: string) => relative(SRC, file).split(sep).join('/');

describe('site layers', () => {
  it('finds every folder of src as a layer', () => {
    const unknown = new Set(files.map(layerOfFile).filter((layer) => !LAYERS.includes(layer)));
    expect([...unknown]).toEqual([]);
  });

  it('lets a layer import only layers below it', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const from = layerOfFile(file);
      for (const specifier of specifiersOf(file)) {
        const to = layerOfSpecifier(specifier, file);
        if (to && to !== from && LAYERS.indexOf(to) >= LAYERS.indexOf(from)) {
          offenders.push(`${rel(file)} (${from}) imports ${specifier} (${to})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps one page from importing another: shared parts go to components, hooks or utils', () => {
    const offenders: string[] = [];
    for (const file of files.filter((path) => layerOfFile(path) === 'pages')) {
      const ownFolder = rel(file).split('/')[1];
      for (const specifier of specifiersOf(file)) {
        if (layerOfSpecifier(specifier, file) !== 'pages') continue;
        const target = specifier.startsWith('@/')
          ? specifier.slice(2)
          : relative(SRC, resolve(dirname(file), specifier))
              .split(sep)
              .join('/');
        const targetFolder = target.split('/')[1];
        if (targetFolder !== ownFolder) offenders.push(`${rel(file)} imports ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does the network only in an api folder', () => {
    const offenders = files
      .filter((file) => !rel(file).split('/').includes('api'))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return specifiersOf(file).includes('axios') || /(^|[^.\w])fetch\(/.test(text);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('reaches no other app', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const specifier of specifiersOf(file)) {
        const leavesSrc =
          specifier.startsWith('.') &&
          relative(SRC, resolve(dirname(file), specifier)).startsWith('..');
        if (leavesSrc || /(^|\/)apps\//.test(specifier))
          offenders.push(`${rel(file)}: ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
