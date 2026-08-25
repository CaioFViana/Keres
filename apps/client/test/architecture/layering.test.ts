/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * As camadas do cliente, verificadas em vez de combinadas.
 *
 * A direção é uma só: `db` → `services` → `hooks`/`state` → `screens`/`components`. Cada regra
 * aqui já passa hoje - o valor delas não é apontar dívida, é a primeira violação falhar num
 * teste em vez de virar o jeito normal de fazer. O teste de `importBoundaries` cuida da outra
 * metade: ciclos e busca de dados dentro da camada de desenho.
 */

const SOURCE_ROOT = resolve(__dirname, '../../src');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const sourceFiles = listSourceFiles(SOURCE_ROOT);
const relativeOf = (path: string) => relative(SOURCE_ROOT, path).replace(/\\/g, '/');

/** Todo especificador importado, seja tipo ou valor: aqui o que importa é a direção. */
const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const importsOf = (path: string) =>
  Array.from(readFileSync(path, 'utf8').matchAll(IMPORT), (match) => match[1]);

/** O caminho, dentro de `src`, para onde um especificador aponta - ou `null` se sai do app. */
function areaOf(specifier: string, origin: string): string | null {
  if (specifier.startsWith('@/src/')) return specifier.slice('@/src/'.length);
  if (!specifier.startsWith('.')) return null;
  const resolved = resolve(join(SOURCE_ROOT, relativeOf(origin), '..'), specifier);
  const inside = relative(SOURCE_ROOT, resolved).replace(/\\/g, '/');
  return inside.startsWith('..') ? null : inside;
}

function filesUnder(area: string) {
  return sourceFiles.filter((path) => relativeOf(path).startsWith(`${area}/`));
}

function offendingImports(files: string[], forbidden: RegExp): string[] {
  return files
    .flatMap((path) =>
      importsOf(path)
        .map((specifier) => areaOf(specifier, path))
        .filter((target): target is string => target !== null && forbidden.test(target))
        .map((target) => `${relativeOf(path)} -> ${target}`),
    )
    .sort();
}

describe('camadas do cliente', () => {
  /**
   * Um serviço que importa uma tela amarra regra de negócio a um layout: a partir daí não dá
   * para testar a regra sem montar componente, nem reusá-la em outra tela.
   */
  it('mantém serviços e banco sem saber que existe interface', () => {
    expect(
      offendingImports(
        [...filesUnder('services'), ...filesUnder('db')],
        /^(components|screens|navigation)\//,
      ),
    ).toEqual([]);
  });

  /** O store guarda estado, não desenha: quem desenha assina o store, nunca o contrário. */
  it('mantém os stores sem saber que existe interface', () => {
    expect(offendingImports(filesUnder('state'), /^(components|screens|navigation)\//)).toEqual([]);
  });

  /**
   * Tela que importa tela é o caminho mais curto para um ciclo e para um `ParamList`
   * duplicado. O que duas telas compartilham vira componente, hook ou serviço.
   */
  it('não deixa uma tela importar outra', () => {
    const offenders = filesUnder('screens')
      .flatMap((path) => {
        const home = relativeOf(path).split('/').slice(0, 2).join('/');
        return importsOf(path)
          .map((specifier) => areaOf(specifier, path))
          .filter(
            (target): target is string =>
              target !== null && target.startsWith('screens/') && !target.startsWith(`${home}/`),
          )
          .map((target) => `${relativeOf(path)} -> ${target}`);
      })
      .sort();

    expect(offenders).toEqual([]);
  });
});

/**
 * Teto de tamanho por arquivo.
 *
 * Não é estética: passando de umas seiscentas linhas, ninguém mais lê o arquivo inteiro antes
 * de editar, e é aí que a mesma regra passa a existir em dois lugares. A lista abaixo é a
 * dívida de hoje e só pode encolher - `toEqual` recusa tanto um arquivo novo estourando o teto
 * quanto um nome que continua listado depois de ter sido quebrado.
 */
const LINE_LIMIT = 600;
const FILES_OVER_THE_LIMIT = [
  'components/features/presence-matrix/PresenceMatrixViewerContent.tsx',
  'navigation/MainSystemStack.tsx',
  'screens/characters/CharacterDetailScreen.tsx',
  'screens/characters/CharacterFormScreen.tsx',
  'screens/enterstack/PublishStoryScreen.tsx',
  'screens/enterstack/ServerRegistrationScreen.tsx',
  'screens/locations/LocationDetailsScreen.tsx',
  'screens/locations/LocationFormScreen.tsx',
  'screens/mainstorystack/StorySettingsScreen.tsx',
  'screens/narrative-elements/chapters/NarrativeElementsListScreen.tsx',
  'screens/narrative-elements/choices/ChoiceFormScreen.tsx',
  'screens/narrative-elements/choices/ChoiceViewScreen.tsx',
  'screens/narrative-elements/scenes/SceneDetailScreen.tsx',
  'screens/narrative-elements/scenes/SceneFormScreen.tsx',
  'services/EntityService.ts',
  'services/SyncConflictService.ts',
  'services/SyncEngineService.ts',
  'services/storymanagement/StoryService.ts',
  'services/storymanagement/SuggestionService.ts',
  'utils/storyAnalysisChecks.ts',
];

describe('tamanho dos arquivos', () => {
  it('não deixa nascer arquivo novo acima do teto', () => {
    const oversized = sourceFiles
      .filter((path) => readFileSync(path, 'utf8').split('\n').length > LINE_LIMIT)
      .map(relativeOf)
      .sort();

    expect(oversized).toEqual([...FILES_OVER_THE_LIMIT].sort());
  });
});
