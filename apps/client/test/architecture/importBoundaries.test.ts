/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * A fronteira entre desenhar e buscar dados, verificada em vez de combinada.
 *
 * Um tipo importado como valor mantém o módulo inteiro no grafo em tempo de execução: até
 * pouco tempo atrás, dez componentes de apresentação arrastavam 92 módulos - drizzle,
 * expo-sqlite, axios e os quatro stores - para desenhar um cartão, e as telas fechavam ciclo
 * com o navegador ao importar o `ParamList` de volta como valor. A regra
 * `@typescript-eslint/consistent-type-imports` impede a reincidência linha a linha; estes
 * testes impedem a reincidência estrutural.
 */

const SOURCE_ROOT = resolve(__dirname, '../../src');

/** Blocos `import type` somem na compilação e não contam para o grafo de execução. */
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
      // Caminho inexistente: o próximo candidato decide.
    }
  }
  return null;
}

/** Só as arestas que sobrevivem à compilação. */
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
 * Componentes que ainda buscam os próprios dados. É dívida conhecida, não licença: a lista só
 * pode encolher. Um componente novo aqui significa que a busca de dados desceu de novo para a
 * camada de desenho - o lugar dela é numa tela ou num hook, com os dados chegando por prop.
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

/** Componentes que desenham conteúdo de história - a base da vitrine estática do site. */
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

describe('fronteiras de import', () => {
  it('não tem ciclos de import', () => {
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

  it('mantém a busca de dados fora da camada de desenho', () => {
    const offenders = sourceFiles
      .filter((path) => relativeOf(path).startsWith('components/'))
      .filter((path) =>
        (graph.get(path) ?? []).some((target) =>
          /^(db|services)\//.test(relativeOf(target)),
        ),
      )
      .map(relativeOf)
      .sort();

    // `toEqual` e não `arrayContaining`: a lista tem que encolher, e um item resolvido que
    // continue listado também é um erro - senão a dívida quitada vira permissão esquecida.
    expect(offenders).toEqual([...COMPONENTS_THAT_STILL_FETCH].sort());
  });

  it('deixa os componentes de apresentação fora do banco e dos serviços', () => {
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
