import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Audits the monorepo locale catalogs against their codebases: every locale file has the same keys
 * (Step "cross-locale consistency"), every key the code actually asks `t()` for exists in
 * every locale (Step "missing keys"), and every key that exists in the locales is
 * reachable from somewhere in the code (Step "unused keys").
 *
 * Earlier versions of this script only trusted `t('literal_key')` call sites. That breaks
 * down in two ways that keep recurring as the app grows:
 *
 *  1. Dynamic keys - `t(\`media_type_${mediaType}\`)`, `t(\`${entityType.toLowerCase()}_plural\`)`.
 *     The concrete key can't be known statically, so these were silently skipped: missing
 *     keys behind a dynamic branch went undetected, and the branch's own key family
 *     couldn't be marked "used" for the unused-key check either.
 *  2. Indirection - `useConfirmDelete({ titleKey: 'delete_character_title', ... })`,
 *     `<GenericRelationDisplay noItemsMessage="notes_empty" />`, `entityFields.ts`'s
 *     `label: 'field_name'`. The literal key is a plain string somewhere in the source,
 *     but never inside a `t(...)` call at that spot - the component/hook calls `t()` on it
 *     later. Chasing every such prop/parameter by name doesn't scale; new ones appear
 *     every time a screen introduces another "pass a translation key down" pattern.
 *
 * The fix used here: keep `t()`/`i18n.t()` call sites as the *authoritative* signal for
 * "missing key" (a real typo there is a real bug - raw key or fallback text on screen),
 * but widen "unused key" detection to also treat any string literal anywhere in the
 * scanned source that happens to match a locale key as evidence of use - covering
 * indirection without having to enumerate every pattern - plus a best-effort regex derived
 * from each dynamic template so its key family isn't flagged unused wholesale, and so a
 * completely broken dynamic branch (no locale key matches its pattern) still surfaces.
 */

interface KeyUsage {
  key: string;
  file: string;
  line: number;
}

interface DynamicKeyPattern {
  pattern: RegExp;
  raw: string;
  file: string;
  line: number;
}

interface ScanResult {
  exactUsages: KeyUsage[];
  dynamicPatterns: DynamicKeyPattern[];
  allLiterals: Set<string>;
  allTemplatePatterns: RegExp[];
}

interface LocaleAuditTarget {
  name: string;
  localesPath: string;
  localeFilePattern: RegExp;
  scanRoots: string[];
  excludedPaths: string[];
}

const repoRoot = path.join(__dirname, '..');
const clientSrcPath = path.join(repoRoot, 'apps', 'client', 'src');
const localesPath = path.join(clientSrcPath, 'locales');
const sharedSrcPath = path.join(repoRoot, 'packages', 'shared');
const adminSrcPath = path.join(repoRoot, 'apps', 'admin', 'src');
const adminLocalesPath = path.join(adminSrcPath, 'i18n', 'locales');
const showcaseSrcPath = path.join(adminSrcPath, 'showcase');
const adminLanguageSelectPath = path.join(adminSrcPath, 'i18n', 'LanguageSelect.tsx');
const siteSrcPath = path.join(repoRoot, 'apps', 'site', 'src');
const siteLocalesPath = path.join(siteSrcPath, 'i18n', 'locales');
// Everywhere a translation key can plausibly originate: the app itself, and the shared
// package whose `entityFields.ts` feeds form-field labels into `t()` indirectly.
const HELP_CONTENT_PATH = path.join(clientSrcPath, 'help', 'content');
const STORY_DEVICES_CONTENT_PATH = path.join(clientSrcPath, 'storyDevices', 'content');
// Prose authored per language: it uses no translation keys and must stay out of the audit.
const DOC_CONTENT_PATHS = [HELP_CONTENT_PATH, STORY_DEVICES_CONTENT_PATH];

const AUDIT_TARGETS: LocaleAuditTarget[] = [
  {
    name: 'client',
    localesPath,
    localeFilePattern: /^(en|pt)\.json$/,
    scanRoots: [clientSrcPath, sharedSrcPath],
    excludedPaths: DOC_CONTENT_PATHS,
  },
  {
    name: 'admin',
    localesPath: adminLocalesPath,
    localeFilePattern: /^admin\.(en|pt)\.json$/,
    scanRoots: [adminSrcPath],
    // The showcase is a different bundle and a different namespace, even though it lives in the same Vite app.
    excludedPaths: [showcaseSrcPath],
  },
  {
    name: 'showcase',
    localesPath: adminLocalesPath,
    localeFilePattern: /^showcase\.(en|pt)\.json$/,
    scanRoots: [showcaseSrcPath, adminLanguageSelectPath],
    excludedPaths: [],
  },
  {
    name: 'site',
    localesPath: siteLocalesPath,
    localeFilePattern: /^site\.(en|pt)\.json$/,
    scanRoots: [siteSrcPath],
    excludedPaths: [],
  },
];

// --- JSON helpers -----------------------------------------------------------------

function flattenObject(obj: Record<string, any>, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], newKey).forEach((k) => keys.add(k));
      } else {
        keys.add(newKey);
      }
    }
  }
  return keys;
}

function removeKeyFromObject(obj: Record<string, any>, keyPath: string): boolean {
  const parts = keyPath.split('.');
  let current: Record<string, any> = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return false;
    }
    if (i === parts.length - 1) {
      if (Object.prototype.hasOwnProperty.call(current, part)) {
        delete current[part];
        return true;
      }
      return false;
    }
    current = current[part];
    if (current === undefined) {
      return false;
    }
  }
  return false;
}

function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObject: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObject[key] = obj[key];
  }
  return sortedObject;
}

function readJsonFile(filePath: string): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error: any) {
    console.error(`❌ Error reading or parsing ${filePath}:`, error.message);
    process.exit(1);
  }
}

function writeJsonFile(filePath: string, data: Record<string, any>) {
  try {
    const sortedData = sortObjectKeys(data);
    fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2) + '\n', 'utf8');
  } catch (error: any) {
    console.error(`❌ Error writing to ${filePath}:`, error.message);
    process.exit(1);
  }
}

// --- Source scanning ---------------------------------------------------------------

/** A test directory, or a `.test.ts`/`.spec.ts` file, in any of the conventions used in this repo. */
function isTestPath(entry: string): boolean {
  return (
    entry === 'test' ||
    entry === 'tests' ||
    entry === '__tests__' ||
    /\.(test|spec)\.tsx?$/.test(entry)
  );
}

function walkSourceFiles(rootDir: string, excludedPaths: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const rootStat = fs.statSync(dir);
    if (rootStat.isFile()) {
      if (dir.endsWith('.ts') || dir.endsWith('.tsx')) files.push(dir);
      return;
    }
    for (const entry of fs.readdirSync(dir)) {
      const entryPath = path.join(dir, entry);
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === '.expo' ||
        // Tests, never a source of keys. A key belongs to the code under test, which is scanned
        // anyway; what a test file contributes is noise that looks exactly like a key. The `label:`
        // rule below reads `{ label: 'F' }` inside a stat-ladder fixture, or a `label: 'mãe'` inside
        // a `toMatchObject`, as a translation request - and reports a missing key nobody can add.
        isTestPath(entry) ||
        excludedPaths.includes(entryPath)
      )
        continue;
      const stat = fs.statSync(entryPath);
      if (stat.isDirectory()) {
        walk(entryPath);
      } else if (entryPath.endsWith('.ts') || entryPath.endsWith('.tsx')) {
        files.push(entryPath);
      }
    }
  };
  walk(rootDir);
  return files;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `media_type_${mediaType}` -> /^media_type_.+$/ - loose on purpose, see file header. */
function patternFromTemplate(node: ts.TemplateExpression): RegExp {
  let source = '^' + escapeRegExp(node.head.text);
  for (const span of node.templateSpans) {
    source += '.+' + escapeRegExp(span.literal.text);
  }
  return new RegExp(source + '$');
}

function indirectPatternFromTemplate(node: ts.TemplateExpression): RegExp | null {
  const staticText = node.head.text + node.templateSpans.map((span) => span.literal.text).join('');
  // `${value}` and other templates with no useful textual anchor would match the whole catalog
  // and hide any genuinely orphaned key.
  return staticText.length >= 3 ? patternFromTemplate(node) : null;
}

function isTranslationCallee(expression: ts.LeftHandSideExpression): boolean {
  if (ts.isIdentifier(expression) && expression.text === 't') return true;
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.name) &&
    expression.name.text === 't'
  )
    return true;
  return false;
}

function scanFile(filePath: string): ScanResult {
  const content = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const exactUsages: KeyUsage[] = [];
  const dynamicPatterns: DynamicKeyPattern[] = [];
  const allLiterals = new Set<string>();
  const allTemplatePatterns: RegExp[] = [];
  const lineOf = (pos: number) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  function visit(node: ts.Node) {
    // Every literal string, anywhere - the fallback that covers keys reaching `t()`
    // through a prop or hook argument instead of a literal `t('key')` at that spot.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      allLiterals.add(node.text);
    }
    // Like indirect literals, templates can reach `t()` after going through helpers
    // (`buildFinding(..., `analysis_scene_${problem}`)`). They count as evidence of use, but not
    // as an authoritative request for a key: ordinary application templates must not produce a
    // false "missing translation".
    if (ts.isTemplateExpression(node)) {
      const pattern = indirectPatternFromTemplate(node);
      if (pattern) allTemplatePatterns.push(pattern);
    }

    if (
      ts.isCallExpression(node) &&
      isTranslationCallee(node.expression) &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0];
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        exactUsages.push({ key: arg.text, file: filePath, line: lineOf(arg.getStart(sourceFile)) });
      } else if (ts.isTemplateExpression(arg)) {
        dynamicPatterns.push({
          pattern: patternFromTemplate(arg),
          raw: arg.getText(sourceFile),
          file: filePath,
          line: lineOf(arg.getStart(sourceFile)),
        });
      }
    }

    // `entityFields.ts`-style metadata: `{ label: 'field_name' }`, resolved via `t(field.label)`
    // somewhere else entirely, so it never appears as a `t(...)` call site itself.
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'label') {
      const init = node.initializer;
      // An empty literal is the absence of a label (a MultiSelectPill's single group has no header),
      // never a key: `t('')` does not exist, and treating it as one only produces a "Missing key ''"
      // that cannot be fixed in the locale.
      if (
        (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) &&
        init.text.trim() !== ''
      ) {
        exactUsages.push({
          key: init.text,
          file: filePath,
          line: lineOf(init.getStart(sourceFile)),
        });
      }
    }

    // Props that carry keys: `noItemsMessage` is translated inside the generic component;
    // `Trans i18nKey` is resolved by react-i18next without an explicit `t()` call.
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'noItemsMessage' || node.name.text === 'i18nKey') &&
      node.initializer
    ) {
      const init = node.initializer;
      const literal = ts.isJsxExpression(init) ? init.expression : init;
      if (literal && (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal))) {
        exactUsages.push({
          key: literal.text,
          file: filePath,
          line: lineOf(literal.getStart(sourceFile)),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { exactUsages, dynamicPatterns, allLiterals, allTemplatePatterns };
}

function toRelative(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

// --- Main ---------------------------------------------------------------------------

function auditTarget(target: LocaleAuditTarget, forceRemoveUnused: boolean): boolean {
  let hasErrors = false;
  console.log(`\n========== ${target.name.toUpperCase()} ==========`);

  // --- Step 1: Read, Sort, and Write all locale JSON files ---
  const localeFiles = fs
    .readdirSync(target.localesPath)
    .filter((file) => target.localeFilePattern.test(file));
  if (localeFiles.length === 0) {
    console.error(`❌ No locale JSON files found for ${target.name}.`);
    return true;
  }

  const allLocalesContent: { [key: string]: Record<string, any> } = {};
  const allLocaleKeysFlattened: { [key: string]: Set<string> } = {};

  console.log('🔄 Sorting locale files...');
  for (const file of localeFiles) {
    const filePath = path.join(target.localesPath, file);
    const data = readJsonFile(filePath);
    writeJsonFile(filePath, data);
    console.log(`✅ Sorted and wrote to ${file}`);
  }

  for (const file of localeFiles) {
    const data = readJsonFile(path.join(target.localesPath, file));
    allLocalesContent[file] = data;
    allLocaleKeysFlattened[file] = flattenObject(data);
  }

  const allUniqueLocaleKeys = new Set<string>();
  for (const file of localeFiles) {
    allLocaleKeysFlattened[file].forEach((key) => allUniqueLocaleKeys.add(key));
  }

  // --- Step 2: Scan the source tree once, collect every kind of evidence ---
  console.log('\n🔄 Scanning source for translation key usage...');
  const exactUsages: KeyUsage[] = [];
  const dynamicPatterns: DynamicKeyPattern[] = [];
  const allLiterals = new Set<string>();
  const allTemplatePatterns: RegExp[] = [];

  for (const root of target.scanRoots) {
    for (const file of walkSourceFiles(root, target.excludedPaths)) {
      const result = scanFile(file);
      exactUsages.push(...result.exactUsages);
      dynamicPatterns.push(...result.dynamicPatterns);
      result.allLiterals.forEach((literal) => allLiterals.add(literal));
      allTemplatePatterns.push(...result.allTemplatePatterns);
    }
  }
  console.log(
    `✅ Scanned. ${exactUsages.length} literal t() usages, ${dynamicPatterns.length} dynamic key patterns.`,
  );

  // First occurrence per key, for readable diagnostics below.
  const firstUsageByKey = new Map<string, KeyUsage>();
  for (const usage of exactUsages) {
    if (!firstUsageByKey.has(usage.key)) {
      firstUsageByKey.set(usage.key, usage);
    }
  }

  // --- Step 3: Missing keys - code asks for a key that no locale file has ---
  console.log('\n🔄 Checking for keys used in code but missing from locale files...');
  for (const [key, usage] of firstUsageByKey) {
    for (const localeFile of localeFiles) {
      if (!allLocaleKeysFlattened[localeFile].has(key)) {
        console.error(
          `❌ Missing key '${key}' in '${localeFile}' (used at ${toRelative(usage.file)}:${usage.line})`,
        );
        hasErrors = true;
      }
    }
  }

  for (const dynamic of dynamicPatterns) {
    for (const localeFile of localeFiles) {
      const hasMatch = [...allLocaleKeysFlattened[localeFile]].some((key) =>
        dynamic.pattern.test(key),
      );
      if (!hasMatch) {
        console.error(
          `❌ Dynamic key ${dynamic.raw} (${toRelative(dynamic.file)}:${dynamic.line}) matches no key in '${localeFile}'`,
        );
        hasErrors = true;
      }
    }
  }

  if (!hasErrors) {
    console.log('✅ All keys used in code are present in every locale file.');
  }

  // --- Step 4: Cross-locale consistency - keys present in one locale but not another ---
  console.log('\n🔄 Validating cross-locale consistency...');
  let crossLocaleErrors = false;
  for (const uniqueKey of allUniqueLocaleKeys) {
    for (const localeFile of localeFiles) {
      if (!allLocaleKeysFlattened[localeFile].has(uniqueKey)) {
        console.error(
          `❌ Missing key '${uniqueKey}' in locale file '${localeFile}' (present in other locale files)`,
        );
        crossLocaleErrors = true;
      }
    }
  }
  if (crossLocaleErrors) {
    hasErrors = true;
  } else {
    console.log('✅ All locale files have consistent keys.');
  }

  // --- Step 5: Unused keys - present in locales, unreachable from the source tree ---
  console.log('\n🔄 Detecting unused translations...');
  const unusedKeys = new Set<string>();
  for (const key of allUniqueLocaleKeys) {
    if (firstUsageByKey.has(key)) continue;
    if (allLiterals.has(key)) continue;
    if (dynamicPatterns.some((dynamic) => dynamic.pattern.test(key))) continue;
    if (allTemplatePatterns.some((pattern) => pattern.test(key))) continue;
    unusedKeys.add(key);
  }

  if (unusedKeys.size > 0) {
    if (forceRemoveUnused) {
      console.log('🗑️ --force flag detected. Removing unused translation keys...');
      for (const localeFile of localeFiles) {
        let fileModified = false;
        for (const unusedKey of unusedKeys) {
          if (removeKeyFromObject(allLocalesContent[localeFile], unusedKey)) {
            console.log(`   - Removed '${unusedKey}' from '${localeFile}'`);
            fileModified = true;
          }
        }
        if (fileModified) {
          writeJsonFile(path.join(target.localesPath, localeFile), allLocalesContent[localeFile]);
          console.log(`✅ Updated '${localeFile}' with unused keys removed.`);
        }
      }
    } else {
      for (const unusedKey of [...unusedKeys].sort()) {
        console.warn(`⚠️ Unused translation key: '${unusedKey}'`);
      }
      console.warn(
        `\n${unusedKeys.size} unused key(s) found. Re-run with --force to remove them from every locale file.`,
      );
      hasErrors = true;
    }
  } else {
    console.log('✅ No unused translations found.');
  }

  console.log(
    hasErrors
      ? `\n🚫 ${target.name}: translation key issues found.`
      : `\n✅ ${target.name}: translations audited and consistent.`,
  );
  return hasErrors;
}

async function auditLocales() {
  const args = process.argv.slice(2);
  const forceRemoveUnused = args.includes('--force');
  let hasErrors = false;

  for (const target of AUDIT_TARGETS) {
    const targetHasErrors = auditTarget(target, forceRemoveUnused);
    hasErrors = targetHasErrors || hasErrors;
  }

  if (hasErrors) {
    console.error('\n🚫 Some translation key issues were found.');
    process.exit(1);
  }
  console.log('\n✅ All translation catalogs are correctly audited and consistent.');
}

auditLocales().catch((error) => {
  console.error('An unexpected error occurred during locale auditing:', error);
  process.exit(1);
});
