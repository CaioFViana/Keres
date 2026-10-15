import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import * as ts from 'typescript';
import { repoRoot } from './lib/packages';

/**
 * Moves source files and rewrites every module specifier that points at them (imports, re-exports,
 * dynamic imports, `require`, `jest.mock`/`vi.mock` and friends), so a folder reorganization is one
 * reviewable step instead of a thousand hand edits.
 *
 *   bun scripts/move-files.ts --map moves.json [--dry-run] [--touched out.txt]
 *   bun scripts/move-files.ts --normalize apps/client [--dry-run]
 *
 * `moves.json`: `{ "mirrorTests": true, "moves": [{ "from": "apps/client/src/hooks/useX.ts", "to": "apps/client/src/hooks/story/useX.ts" }] }`.
 * A `from` ending in `/` moves a whole directory. Platform variants (`x.web.ts`) travel with `x.ts`.
 * With `mirrorTests`, `test/<same path>.test.ts(x)` follows its source file.
 *
 * `--normalize <package root>` moves nothing: it rewrites every parent-relative (`../`) specifier of
 * that package to its alias. The import rule of the repo is: alias across folders, `./` for the same
 * folder or below, never `../` (see docs/file_structure.md). `packages/shared` is exempt: it is
 * consumed as source by the apps, and an alias inside it would not resolve for them.
 */

interface MoveEntry {
  from: string;
  to: string;
}

interface MoveMap {
  mirrorTests?: boolean;
  moves: MoveEntry[];
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

type ProbeKind = 'exact' | 'ext' | 'index';

interface Resolved {
  file: string;
  kind: ProbeKind;
}

/** Package roots, longest first, so `apps/client` wins over a hypothetical `apps`. */
const PACKAGE_ROOTS = [
  'apps/admin',
  'apps/api',
  'apps/client',
  'apps/desktop',
  'apps/payments',
  'apps/site',
  'apps/verification',
  'packages/shared',
];

/** Where each package's source and test roots are, for the `mirrorTests` convention. */
const MIRROR_ROOTS: Record<string, { src: string; test: string }> = {
  'apps/admin': { src: 'apps/admin/src/', test: 'apps/admin/test/' },
  'apps/api': { src: 'apps/api/src/', test: 'apps/api/test/' },
  'apps/client': { src: 'apps/client/src/', test: 'apps/client/test/' },
  'packages/shared': { src: 'packages/shared/', test: 'packages/shared/test/' },
};

/**
 * Alias prefixes each package resolves and emits. `@/x` is `<dir>/x`. An app without an entry is
 * written relative.
 */
const ALIASES: Record<string, { prefix: string; dir: string }[]> = {
  'apps/client': [{ prefix: '@/', dir: 'apps/client' }],
  'apps/api': [
    { prefix: '@/', dir: 'apps/api/src' },
    { prefix: '@test/', dir: 'apps/api/test' },
    { prefix: '@scripts/', dir: 'apps/api/scripts' },
  ],
};

const SHARED_ROOT = 'packages/shared';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const PROBE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.d.ts'];
const PLATFORM_VARIANT = /\.(web|native|android|ios)$/;
const MOCK_CALLS = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'requireActual',
  'requireMock',
  'importActual',
  'importMock',
  'createMockFromModule',
]);

function posix(path: string): string {
  return path.replace(/\\/g, '/');
}

function dirOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function joinPosix(base: string, rest: string): string {
  const out: string[] = [];
  for (const part of [...(base ? base.split('/') : []), ...rest.split('/')]) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function relativePosix(fromDir: string, to: string): string {
  const a = fromDir ? fromDir.split('/') : [];
  const b = to.split('/');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

function packageOf(path: string): string | null {
  return PACKAGE_ROOTS.find((root) => path === root || path.startsWith(`${root}/`)) ?? null;
}

function stripSourceExtension(path: string): string {
  return path.replace(/\.d\.ts$/, '').replace(/\.(tsx?|jsx?|mjs|cjs|mts|cts)$/, '');
}

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return out.split('\0').filter(Boolean).map(posix);
}

class Workspace {
  readonly files: Set<string>;
  /** Old path -> new path, after expansion. */
  readonly moves = new Map<string, string>();

  constructor(tracked: string[]) {
    this.files = new Set(tracked);
  }

  expand(map: MoveMap): void {
    const add = (from: string, to: string) => {
      if (!this.files.has(from)) throw new Error(`Cannot move, not tracked: ${from}`);
      if (from === to) return;
      this.moves.set(from, to);
    };
    for (const entry of map.moves) {
      const from = posix(entry.from);
      const to = posix(entry.to);
      if (from.endsWith('/')) {
        for (const file of this.files) {
          if (file.startsWith(from)) add(file, to + file.slice(from.length));
        }
      } else {
        add(from, to);
        // Platform variants and type shims travel with the module they belong to.
        const base = stripSourceExtension(from);
        const newBase = stripSourceExtension(to);
        for (const variant of ['web', 'native', 'android', 'ios']) {
          for (const ext of ['.ts', '.tsx']) {
            const sibling = `${base}.${variant}${ext}`;
            if (this.files.has(sibling)) add(sibling, `${newBase}.${variant}${ext}`);
          }
        }
      }
    }
    if (map.mirrorTests) {
      for (const [from, to] of [...this.moves]) {
        const pkg = packageOf(from);
        const roots = pkg ? MIRROR_ROOTS[pkg] : undefined;
        if (!roots || !from.startsWith(roots.src) || from.startsWith(roots.test)) continue;
        if (packageOf(to) !== pkg || !to.startsWith(roots.src)) continue;
        const oldTest = roots.test + stripSourceExtension(from.slice(roots.src.length));
        const newTest = roots.test + stripSourceExtension(to.slice(roots.src.length));
        for (const ext of ['.test.ts', '.test.tsx']) {
          if (this.files.has(oldTest + ext)) add(oldTest + ext, newTest + ext);
        }
      }
    }
    const targets = new Map<string, string>();
    for (const [from, to] of this.moves) {
      const clash = targets.get(to);
      if (clash) throw new Error(`Two files move to ${to}: ${clash} and ${from}`);
      if (this.files.has(to) && !this.moves.has(to)) throw new Error(`Destination exists: ${to}`);
      targets.set(to, from);
    }
  }

  moved(path: string): string {
    return this.moves.get(path) ?? path;
  }

  /** Resolves a specifier the way the bundlers do, against the tracked file list. */
  resolve(spec: string, importer: string): Resolved | null {
    let base: string | null = null;
    if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
      base = joinPosix(dirOf(importer), spec);
    } else if (spec.startsWith('@keres/shared/')) {
      base = `${SHARED_ROOT}/${spec.slice('@keres/shared/'.length)}`;
    } else {
      const pkg = packageOf(importer);
      for (const alias of (pkg && ALIASES[pkg]) || []) {
        if (spec.startsWith(alias.prefix))
          base = joinPosix(alias.dir, spec.slice(alias.prefix.length));
      }
    }
    if (base === null) return null;
    if (this.files.has(base) && /\.[a-z]+$/i.test(base)) return { file: base, kind: 'exact' };
    for (const ext of PROBE_EXTENSIONS) {
      if (this.files.has(base + ext)) return { file: base + ext, kind: 'ext' };
    }
    for (const variant of ['web', 'native', 'android', 'ios']) {
      for (const ext of ['.ts', '.tsx']) {
        if (this.files.has(`${base}.${variant}${ext}`))
          return { file: `${base}.${variant}${ext}`, kind: 'ext' };
      }
    }
    for (const ext of PROBE_EXTENSIONS) {
      if (this.files.has(`${base}/index${ext}`))
        return { file: `${base}/index${ext}`, kind: 'index' };
    }
    return null;
  }
}

/** The specifier path for a resolved file, without the platform variant or extension the bundler infers. */
function specifierBase(file: string, kind: ProbeKind, keepVariant: boolean): string {
  if (kind === 'exact') return file;
  if (kind === 'index') return dirOf(file);
  const base = stripSourceExtension(file);
  return keepVariant ? base : base.replace(PLATFORM_VARIANT, '');
}

function aliasFor(importerPkg: string | null, target: string): string | null {
  for (const alias of (importerPkg && ALIASES[importerPkg]) || []) {
    if (target === alias.dir || target.startsWith(`${alias.dir}/`)) {
      return alias.prefix + target.slice(alias.dir.length + 1);
    }
  }
  return null;
}

/** The specifier to write for `target` from `importerNew`, or null when nothing should change. */
function emit(
  spec: string,
  importerNew: string,
  resolved: Resolved,
  targetNew: string,
  targetMoved: boolean,
  importerMoved: boolean,
  normalize: boolean,
): string | null {
  const importerPkg = packageOf(importerNew);
  const targetPkg = packageOf(targetNew);
  const isRelative = spec.startsWith('.');
  // A specifier that names the variant itself (`useEdgeFont.web`) is a request for that file.
  const base = specifierBase(
    targetNew,
    resolved.kind,
    PLATFORM_VARIANT.test(stripSourceExtension(spec)),
  );

  if (targetPkg === SHARED_ROOT && importerPkg !== SHARED_ROOT) {
    if (spec === '@keres/shared') return null;
    if (!targetMoved) return null;
    if (isRelative || spec.startsWith('@keres/shared/')) {
      return base === `${SHARED_ROOT}/index`
        ? '@keres/shared'
        : `@keres/shared/${base.slice(SHARED_ROOT.length + 1)}`;
    }
    return null;
  }

  if (normalize) {
    if (!spec.startsWith('../') && spec !== '..') return null;
  } else if (!targetMoved && !(isRelative && importerMoved)) {
    // An alias specifier does not depend on where the importer sits, so it only changes with its target.
    return null;
  }

  const rel = relativePosix(dirOf(importerNew), base);
  // Same folder or below: the rule allows `./`, and it survives moving the folder as a whole.
  if (isRelative && !rel.startsWith('..') && importerPkg === targetPkg) return `./${rel}`;
  const alias = importerPkg === targetPkg ? aliasFor(importerPkg, base) : null;
  if (alias) return alias;
  // No alias reaches the target (a package without one, or a path outside its alias dir): stay relative.
  return rel.startsWith('.') ? rel : `./${rel}`;
}

interface Specifier {
  node: ts.StringLiteralLike;
  text: string;
}

function collectSpecifiers(source: ts.SourceFile): Specifier[] {
  const found: Specifier[] = [];
  const push = (node: ts.Node | undefined) => {
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      found.push({ node, text: node.text });
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      push(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      push(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      push(node.argument.literal);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const isMock =
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        (callee.expression.text === 'jest' || callee.expression.text === 'vi') &&
        MOCK_CALLS.has(callee.name.text);
      if (isImport || isRequire || isMock) push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function isSourceFile(path: string): boolean {
  return (
    (SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext)) && packageOf(path) !== null) ||
    (path.startsWith('scripts/') && SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext)))
  );
}

function quoteOf(node: ts.StringLiteralLike, text: string): string {
  const raw = text.slice(node.getStart(), node.getStart() + 1);
  return raw === '"' || raw === '`' ? raw : "'";
}

interface Plan {
  edits: Map<string, Edit[]>;
  unresolved: { file: string; spec: string }[];
  stillRelative: { file: string; spec: string }[];
}

function plan(workspace: Workspace, normalizeRoot: string | null): Plan {
  const edits = new Map<string, Edit[]>();
  const unresolved: Plan['unresolved'] = [];
  const stillRelative: Plan['stillRelative'] = [];
  for (const file of workspace.files) {
    if (!isSourceFile(file)) continue;
    if (normalizeRoot && !file.startsWith(`${normalizeRoot}/`)) continue;
    const text = readFileSync(join(repoRoot, file), 'utf8');
    if (
      !text.includes('from') &&
      !text.includes('require') &&
      !text.includes('import') &&
      !text.includes('mock')
    )
      continue;
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const importerNew = workspace.moved(file);
    const importerMoved = importerNew !== file;
    const fileEdits: Edit[] = [];
    for (const { node, text: spec } of collectSpecifiers(source)) {
      const local =
        spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('@keres/shared/');
      if (!local) continue;
      const resolved = workspace.resolve(spec, file);
      if (!resolved) {
        unresolved.push({ file, spec });
        continue;
      }
      const targetNew = workspace.moved(resolved.file);
      const next = emit(
        spec,
        importerNew,
        resolved,
        targetNew,
        targetNew !== resolved.file,
        importerMoved,
        normalizeRoot !== null,
      );
      if (next === null || next === spec) continue;
      if (normalizeRoot && next.startsWith('..')) {
        stillRelative.push({ file, spec });
        continue;
      }
      const quote = quoteOf(node, text);
      fileEdits.push({
        start: node.getStart(),
        end: node.getEnd(),
        text: `${quote}${next}${quote}`,
      });
    }
    if (fileEdits.length > 0) edits.set(file, fileEdits);
  }
  return { edits, unresolved, stillRelative };
}

function applyEdits(text: string, edits: Edit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

function removeEmptyDirs(paths: Set<string>): void {
  for (const path of [...paths].sort((a, b) => b.length - a.length)) {
    const absolute = join(repoRoot, path);
    if (existsSync(absolute) && readdirSync(absolute).length === 0) {
      try {
        rmdirSync(absolute);
      } catch {
        // A directory another process holds open stays; it is empty and harmless.
      }
    }
  }
}

const TEXT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.html',
];

/** Old paths still named somewhere (a script that builds a path by string, a doc), for a human to fix. */
function leftoverReferences(workspace: Workspace): string[] {
  const needles = new Map<string, string>();
  for (const old of workspace.moves.keys()) {
    const noExt = stripSourceExtension(old);
    needles.set(noExt, old);
    needles.set(old, old);
    const pkg = packageOf(old);
    if (pkg) {
      needles.set(noExt.slice(pkg.length + 1), old);
      needles.set(old.slice(pkg.length + 1), old);
    }
  }
  const dirs = new Set<string>();
  for (const old of workspace.moves.keys()) {
    const dir = dirOf(old);
    dirs.add(dir);
    const pkg = packageOf(old);
    if (pkg && dir.length > pkg.length) dirs.add(dir.slice(pkg.length + 1));
  }
  const report: string[] = [];
  const token = /[A-Za-z0-9_./@-]+/g;
  for (const file of readdirTracked(workspace)) {
    if (!TEXT_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;
    if (
      file === 'bun.lock' ||
      file.includes('/locales/') ||
      file.startsWith('docs/finished_planning')
    )
      continue;
    if (workspace.moves.has(file)) continue;
    let text: string;
    try {
      text = readFileSync(join(repoRoot, workspace.moved(file)), 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(token)) {
        const word = match[0].replace(/^\.\//, '').replace(/[.,;:]+$/, '');
        const hit =
          needles.get(word) ?? (dirs.has(word) ? `${word}/ (folder with moved files)` : undefined);
        if (hit) report.push(`${file}:${index + 1}: ${word} -> ${hit}`);
      }
    });
  }
  return report;
}

function readdirTracked(workspace: Workspace): string[] {
  return [...workspace.files];
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const value = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const dryRun = flag('--dry-run');
  const mapPath = value('--map');
  const normalizeRoot = value('--normalize') ?? null;
  const touchedPath = value('--touched');
  if (!mapPath && !normalizeRoot) {
    console.error(
      'Usage: bun scripts/move-files.ts (--map moves.json | --normalize <package root>) [--dry-run] [--touched file]',
    );
    process.exit(2);
  }

  const workspace = new Workspace(trackedFiles());
  if (mapPath) workspace.expand(JSON.parse(readFileSync(mapPath, 'utf8')) as MoveMap);

  const { edits, unresolved, stillRelative } = plan(workspace, normalizeRoot);
  const editedFiles = [...edits.keys()];
  console.log(
    `${workspace.moves.size} file(s) to move, ${editedFiles.length} file(s) with rewritten specifiers.`,
  );
  if (unresolved.length > 0) {
    console.log(`\nUnresolved local specifiers (${unresolved.length}) - check by hand:`);
    for (const item of unresolved.slice(0, 60)) console.log(`  ${item.file}: ${item.spec}`);
  }
  if (stillRelative.length > 0) {
    console.log(`\nStill relative, no alias reaches them (${stillRelative.length}):`);
    for (const item of stillRelative.slice(0, 60)) console.log(`  ${item.file}: ${item.spec}`);
  }
  if (dryRun) {
    for (const [from, to] of [...workspace.moves].slice(0, 80)) console.log(`  ${from} -> ${to}`);
    return;
  }

  // Edits are computed against the old layout; apply them to the old content, then relocate.
  const contents = new Map<string, string>();
  for (const [file, fileEdits] of edits) {
    contents.set(file, applyEdits(readFileSync(join(repoRoot, file), 'utf8'), fileEdits));
  }
  const vacated = new Set<string>();
  for (const [from, to] of workspace.moves) {
    mkdirSync(dirname(join(repoRoot, to)), { recursive: true });
    renameSync(join(repoRoot, from), join(repoRoot, to));
    vacated.add(dirOf(from));
  }
  for (const [file, content] of contents) {
    writeFileSync(join(repoRoot, workspace.moved(file)), content);
  }
  removeEmptyDirs(vacated);

  const touched = new Set<string>(editedFiles.map((file) => workspace.moved(file)));
  for (const [from, to] of workspace.moves) {
    touched.add(from);
    touched.add(to);
  }
  if (touchedPath) writeFileSync(touchedPath, [...touched].sort().join('\n') + '\n');

  if (workspace.moves.size > 0) {
    const leftovers = leftoverReferences(workspace);
    if (leftovers.length > 0) {
      console.log(`\nOld paths still named (${leftovers.length}) - fix by hand:`);
      for (const line of leftovers.slice(0, 120)) console.log(`  ${line}`);
    }
  }
}

main();
