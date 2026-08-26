/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * The border between drawing and fetching data, checked rather than agreed.
 *
 * A type imported as a value keeps the whole module in the runtime graph: until
 * recently, ten presentation components dragged 92 modules - drizzle,
 * expo-sqlite, axios and the four stores - along to draw a card, and the screens closed a cycle
 * with the navigator by importing the `ParamList` back as a value. The
 * `@typescript-eslint/consistent-type-imports` rule stops the relapse line by line; these
 * tests stop the structural relapse.
 */

const SOURCE_ROOT = resolve(__dirname, '../../src');

/** `import type` blocks vanish at compile time and do not count towards the runtime graph. */
const TYPE_BLOCK = /^import\s+type\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/gm;
const TYPE_DEFAULT = /^import\s+type\s+\w+\s+from\s*['"][^'"]+['"];?/gm;
const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function resolveImport(specifier: string, origin: string): string | null {
  const base = specifier.startsWith('@/src/')
    ? join(SOURCE_ROOT, specifier.slice('@/src/'.length))
    : specifier.startsWith('.')
      ? resolve(dirname(origin), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // A non-existent path: the next candidate decides.
    }
  }
  return null;
}

/** Only the edges that survive compilation. */
function valueImportsOf(path: string): string[] {
  const source = readFileSync(path, 'utf8').replace(TYPE_BLOCK, '').replace(TYPE_DEFAULT, '');
  return Array.from(source.matchAll(IMPORT), (match) => match[1])
    .map((specifier) => resolveImport(specifier, path))
    .filter((target): target is string => target !== null);
}

const sourceFiles = listSourceFiles(SOURCE_ROOT);
const relativeOf = (path: string) => relative(SOURCE_ROOT, path).replace(/\\/g, '/');
const graph = new Map(sourceFiles.map((path) => [path, valueImportsOf(path)]));

/**
 * Components that still fetch their own data. It is known debt, not a licence: the list can only
 * shrink. A new component here means data fetching has dropped back down into the
 * drawing layer - its place is in a screen or a hook, with the data arriving by prop.
 */
const COMPONENTS_THAT_STILL_FETCH = [
  'components/common/forms/CustomAttributeFields/AttributeValueInput.tsx',
  'components/common/forms/CustomAttributeFields/CustomAttributeDetailFields.tsx',
  'components/common/inputs/SuggestionListInput/SuggestionListInput.tsx',
  'components/common/inputs/SuggestionTextInput/SuggestionTextInput.tsx',
  'components/features/app/SyncInitializer.tsx',
  'components/features/comments/CommentList/CommentList.tsx',
  'components/features/comments/CommentThreadModal/CommentThreadModal.tsx',
  'components/features/favorites/FavoritedByList/FavoritedByList.tsx',
  'components/features/item-journeys/ItemJourney/ItemJourneyTimeline.tsx',
  'components/features/list-items/CommentListItem.tsx',
  'components/features/operation-log/OperationLogList/OperationLogList.tsx',
  'components/features/presence-matrix/PresenceMatrixViewerContent.tsx',
  'components/features/scenes/SceneReorderModal/SceneReorderModal.tsx',
  'components/features/sync/ConflictFieldDiffSheet/ConflictFieldDiffSheet.tsx',
  'components/features/sync/SyncConflictReviewSheet/SyncConflictReviewSheet.tsx',
];

/** Components that draw story content - the basis of the site's static showcase. */
const PRESENTATIONAL_SEEDS = [
  'components/features/list-items/CharacterListItem.tsx',
  'components/features/list-items/ItemListItem.tsx',
  'components/features/list-items/SceneListItem.tsx',
  'components/common/display/DetailField/DetailField.tsx',
  'components/common/display/EntityMetadata/EntityMetadata.tsx',
  'components/common/display/TagList/TagList.tsx',
  'components/common/display/CollapsibleCard/CollapsibleCard.tsx',
  'components/common/lists/GenericListItem/GenericListItem.tsx',
  'components/features/relations/RelationManager/GenericRelationDisplay.tsx',
  'components/features/relations/RelationManager/RelationRow.tsx',
];

describe('import boundaries', () => {
  it('has no import cycles', () => {
    const state = new Map<string, 'visiting' | 'done'>();
    const cycles: string[] = [];

    const visit = (path: string, trail: string[]) => {
      if (state.get(path) === 'done') return;
      if (state.get(path) === 'visiting') {
        cycles.push([...trail.slice(trail.indexOf(path)), path].map(relativeOf).join(' -> '));
        return;
      }
      state.set(path, 'visiting');
      for (const target of graph.get(path) ?? []) visit(target, [...trail, path]);
      state.set(path, 'done');
    };

    for (const path of sourceFiles) visit(path, []);
    expect(cycles).toEqual([]);
  });

  it('keeps data fetching out of the drawing layer', () => {
    const offenders = sourceFiles
      .filter((path) => relativeOf(path).startsWith('components/'))
      .filter((path) =>
        (graph.get(path) ?? []).some((target) => /^(db|services)\//.test(relativeOf(target))),
      )
      .map(relativeOf)
      .sort();

    // `toEqual` and not `arrayContaining`: the list has to shrink, and a resolved item that
    // stays listed is an error too - otherwise settled debt becomes a forgotten permission.
    expect(offenders).toEqual([...COMPONENTS_THAT_STILL_FETCH].sort());
  });

  it('keeps presentation components away from the database and the services', () => {
    const seen = new Set<string>();
    const queue = PRESENTATIONAL_SEEDS.map((seed) => join(SOURCE_ROOT, seed));
    while (queue.length > 0) {
      const path = queue.pop()!;
      if (seen.has(path)) continue;
      seen.add(path);
      queue.push(...(graph.get(path) ?? []));
    }

    const reached = [...seen].map(relativeOf).sort();
    expect(reached.filter((path) => /^(db|services|state)\//.test(path))).toEqual([]);
  });
});
