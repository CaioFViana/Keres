/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * The client's layers, checked rather than agreed.
 *
 * The direction is only one: `db` → `services` → `hooks`/`state` → `screens`/`components`. Every rule
 * here already passes today - their value is not to point at debt, it is that the first violation fails a
 * test instead of becoming the normal way of doing things. The `importBoundaries` test takes care of the other
 * half: cycles and data fetching inside the drawing layer.
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

/** Every imported specifier, be it a type or a value: what matters here is the direction. */
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

describe('client layers', () => {
  /**
   * A service that imports a screen ties business rules to a layout: from then on there is no way
   * to test the rule without mounting a component, nor to reuse it on another screen.
   */
  it('keeps services and database unaware that a UI exists', () => {
    expect(
      offendingImports(
        [...filesUnder('services'), ...filesUnder('db')],
        /^(components|screens|navigation)\//,
      ),
    ).toEqual([]);
  });

  /** The store holds state, it does not draw: whoever draws subscribes to the store, never the other way round. */
  it('keeps the stores unaware that a UI exists', () => {
    expect(offendingImports(filesUnder('state'), /^(components|screens|navigation)\//)).toEqual([]);
  });

  /**
   * A screen importing a screen is the shortest path to a cycle and to a duplicated
   * `ParamList`. What two screens share becomes a component, a hook or a service.
   */
  it('does not let one screen import another', () => {
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

describe('scene form responsibilities', () => {
  it('keeps store initialization and persistence coordination outside the screen', () => {
    const screen = readFileSync(
      resolve(SOURCE_ROOT, 'screens/narrative-elements/scenes/SceneFormScreen.tsx'),
      'utf8',
    );

    expect(screen).toContain('useSceneFormResources');
    expect(screen).toContain('useSceneFormState');
    expect(screen).toContain('useSceneFormActions');
    expect(screen).toContain('useSceneFormAssociations');
    expect(screen).not.toMatch(/state\/(chapter|character|item|location)Store/);
    expect(screen).not.toMatch(/createSceneService|setDbAndStoryId|initializeService/);
    expect(screen).not.toMatch(
      /saveSceneWithRelations|createAttributeValueService|AppAlert|entityEventEmitter/,
    );
    expect(screen).not.toMatch(/useEntityEffects|useEntityRelations|useSceneCharacterPresence/);
  });
});

describe('character form responsibilities', () => {
  it('keeps service setup and persistence coordination outside the screen', () => {
    const screen = readFileSync(
      resolve(SOURCE_ROOT, 'screens/characters/CharacterFormScreen.tsx'),
      'utf8',
    );
    const state = readFileSync(
      resolve(SOURCE_ROOT, 'screens/characters/useCharacterFormState.ts'),
      'utf8',
    );
    const actions = readFileSync(
      resolve(SOURCE_ROOT, 'screens/characters/useCharacterFormActions.ts'),
      'utf8',
    );
    const associations = readFileSync(
      resolve(SOURCE_ROOT, 'screens/characters/useCharacterFormAssociations.ts'),
      'utf8',
    );

    expect(screen).toContain('useCharacterFormResources');
    expect(screen).toContain('useCharacterFormState');
    expect(screen).toContain('useCharacterFormActions');
    expect(screen).toContain('useCharacterFormAssociations');
    expect(screen).not.toMatch(/createCharacterService|createCharacterRelationService/);
    expect(screen).not.toMatch(
      /saveEntityWithSecondaryData|createAttributeValueService|AppAlert|entityEventEmitter/,
    );
    expect(screen).not.toMatch(/useEntityRelations|useStoryStats|useConfirmDelete|useAsyncOperation/);
    expect(state).toContain('initialCharacterId');
    expect(state).toContain('retainPersistedCharacterId');
    expect(state).not.toMatch(/getById\(currentCharacterId/);
    expect(actions).toContain('saveEntityWithSecondaryData');
    expect(actions).toContain('retainPersistedCharacterId');
    expect(associations).toContain('preserveDraftOnEntityCreation: true');
  });
});

describe('location form responsibilities', () => {
  it('keeps service setup and persistence coordination outside the screen', () => {
    const screen = readFileSync(
      resolve(SOURCE_ROOT, 'screens/locations/LocationFormScreen.tsx'),
      'utf8',
    );
    const state = readFileSync(
      resolve(SOURCE_ROOT, 'screens/locations/useLocationFormState.ts'),
      'utf8',
    );
    const actions = readFileSync(
      resolve(SOURCE_ROOT, 'screens/locations/useLocationFormActions.ts'),
      'utf8',
    );
    const associations = readFileSync(
      resolve(SOURCE_ROOT, 'screens/locations/useLocationFormAssociations.ts'),
      'utf8',
    );

    expect(screen).toContain('useLocationFormResources');
    expect(screen).toContain('useLocationFormState');
    expect(screen).toContain('useLocationFormActions');
    expect(screen).toContain('useLocationFormAssociations');
    expect(screen).not.toMatch(/createLocationService|createLocationRelationService/);
    expect(screen).not.toMatch(
      /saveEntityWithSecondaryData|createAttributeValueService|AppAlert|entityEventEmitter/,
    );
    expect(screen).not.toMatch(/useEntityRelations|useConfirmDelete|useAsyncOperation/);
    expect(state).toContain('initialLocationId');
    expect(state).toContain('retainPersistedLocationId');
    expect(state).not.toMatch(/getById\(currentLocationId/);
    expect(actions).toContain('saveEntityWithSecondaryData');
    expect(actions).toContain('retainPersistedLocationId');
    expect(associations).toContain('preserveDraftOnEntityCreation: true');
  });
});

describe('extracted multi-step form responsibilities', () => {
  const forms = [
    {
      label: 'WorldRule',
      dir: 'screens/worldrules',
      screen: 'WorldRuleFormScreen.tsx',
      prefix: 'WorldRule',
      idName: 'WorldRuleId',
      createService: 'createWorldRuleService',
    },
    {
      label: 'Item',
      dir: 'screens/items',
      screen: 'ItemFormScreen.tsx',
      prefix: 'Item',
      idName: 'ItemId',
      createService: 'createItemService',
    },
    {
      label: 'Note',
      dir: 'screens/notes',
      screen: 'NoteFormScreen.tsx',
      prefix: 'Note',
      idName: 'NoteId',
      createService: 'createNoteService',
    },
    {
      label: 'Chapter',
      dir: 'screens/narrative-elements/chapters',
      screen: 'ChapterFormScreen.tsx',
      prefix: 'Chapter',
      idName: 'ChapterId',
      createService: 'createChapterService',
    },
    {
      label: 'Choice',
      dir: 'screens/narrative-elements/choices',
      screen: 'ChoiceFormScreen.tsx',
      prefix: 'Choice',
      idName: 'ChoiceId',
      createService: 'createChoiceService',
    },
    {
      label: 'ItemJourney',
      dir: 'screens/itemJourneys',
      screen: 'ItemJourneyFormScreen.tsx',
      prefix: 'ItemJourney',
      idName: 'ItemJourneyId',
      createService: 'createItemJourneyService',
    },
  ] as const;

  it.each(forms)(
    '$label keeps service setup and persistence coordination outside the screen',
    ({ dir, screen, prefix, idName, createService }) => {
      const screenSource = readFileSync(resolve(SOURCE_ROOT, dir, screen), 'utf8');
      const state = readFileSync(resolve(SOURCE_ROOT, dir, `use${prefix}FormState.ts`), 'utf8');
      const actions = readFileSync(
        resolve(SOURCE_ROOT, dir, `use${prefix}FormActions.ts`),
        'utf8',
      );
      const associations = readFileSync(
        resolve(SOURCE_ROOT, dir, `use${prefix}FormAssociations.ts`),
        'utf8',
      );

      expect(screenSource).toContain(`use${prefix}FormResources`);
      expect(screenSource).toContain(`use${prefix}FormState`);
      expect(screenSource).toContain(`use${prefix}FormActions`);
      expect(screenSource).toContain(`use${prefix}FormAssociations`);
      expect(screenSource).not.toMatch(new RegExp(createService));
      expect(screenSource).not.toMatch(
        /saveEntityWithSecondaryData|createAttributeValueService|AppAlert|entityEventEmitter/,
      );
      expect(screenSource).not.toMatch(
        /useEntityRelations|useConfirmDelete|useAsyncOperation/,
      );
      expect(state).toContain(`initial${idName}`);
      expect(state).toContain(`retainPersisted${idName}`);
      expect(state).not.toMatch(new RegExp(`getById\\(current${idName}`));
      expect(actions).toContain('saveEntityWithSecondaryData');
      expect(actions).toContain(`retainPersisted${idName}`);
      expect(associations).toContain('preserveDraftOnEntityCreation: true');
    },
  );
});

describe('extracted simple form responsibilities', () => {
  const forms = [
    {
      label: 'Story',
      dir: 'screens/enterstack',
      screen: 'StoryFormScreen.tsx',
      prefix: 'Story',
      idParam: 'initialStoryId',
      createService: 'createStoryService',
    },
    {
      label: 'Pack',
      dir: 'screens/packs',
      screen: 'PackFormScreen.tsx',
      prefix: 'Pack',
      idParam: 'initialPackId',
      createService: 'createPackService',
    },
    {
      label: 'Friendship',
      dir: 'screens/enterstack',
      screen: 'FriendshipFormScreen.tsx',
      prefix: 'Friendship',
      idParam: null,
      createService: 'createFriendshipService',
    },
    {
      label: 'StorySchemaField',
      dir: 'screens/storyschema',
      screen: 'StorySchemaFieldFormScreen.tsx',
      prefix: 'StorySchemaField',
      idParam: 'initialFieldId',
      createService: 'createStorySchemaFieldService',
    },
    {
      label: 'Plot',
      dir: 'screens/plots',
      screen: 'PlotFormScreen.tsx',
      prefix: 'Plot',
      idParam: 'plotId',
      createService: 'createPlotService',
    },
    {
      label: 'Tag',
      dir: 'screens/tags',
      screen: 'TagFormScreen.tsx',
      prefix: 'Tag',
      idParam: 'tagId',
      createService: 'createTagService',
    },
    {
      label: 'Stat',
      dir: 'screens/stats',
      screen: 'StatFormScreen.tsx',
      prefix: 'Stat',
      idParam: 'statId',
      createService: 'createStatService',
    },
    {
      label: 'Route',
      dir: 'screens/routes',
      screen: 'RouteFormScreen.tsx',
      prefix: 'Route',
      idParam: 'routeId',
      createService: 'createRouteService',
    },
  ] as const;

  it.each(forms)(
    '$label keeps service setup and persistence coordination outside the screen',
    ({ dir, screen, prefix, idParam, createService }) => {
      const screenSource = readFileSync(resolve(SOURCE_ROOT, dir, screen), 'utf8');
      const state = readFileSync(resolve(SOURCE_ROOT, dir, `use${prefix}FormState.ts`), 'utf8');
      const actions = readFileSync(
        resolve(SOURCE_ROOT, dir, `use${prefix}FormActions.ts`),
        'utf8',
      );

      expect(screenSource).toContain(`use${prefix}FormResources`);
      expect(screenSource).toContain(`use${prefix}FormState`);
      expect(screenSource).toContain(`use${prefix}FormActions`);
      expect(screenSource).not.toMatch(new RegExp(createService));
      expect(screenSource).not.toMatch(/AppAlert|entityEventEmitter|useConfirmDelete|useAsyncOperation/);
      if (idParam) {
        expect(state).toContain(idParam);
      }
      expect(actions.length).toBeGreaterThan(0);
    },
  );
});

/**
 * A per-file size ceiling.
 *
 * It is not aesthetics: past some six hundred lines, nobody reads the whole file before
 * editing any more, and that is when the same rule starts existing in two places. The list below is
 * today's debt and can only shrink - `toEqual` refuses both a new file blowing the ceiling
 * and a name that stays listed after having been broken up.
 */
const LINE_LIMIT = 600;
const FILES_OVER_THE_LIMIT: Array<string> = [];

/** Counts only meaningful source lines, leaving comments and visual spacing out of the ceiling. */
function codeLineCount(content: string): number {
  let inBlockComment = false;
  let inString: string | null = null;
  let lines = 0;

  for (const line of content.split(/\r?\n/)) {
    let hasCode = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const next = line[index + 1];
      if (inBlockComment) {
        if (character === '*' && next === '/') {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }
      if (inString) {
        hasCode = true;
        if (character === '\\') index += 1;
        else if (character === inString) inString = null;
        continue;
      }
      if (character === '/' && next === '/') break;
      if (character === '/' && next === '*') {
        inBlockComment = true;
        index += 1;
        continue;
      }
      if (character === "'" || character === '"' || character === '`') {
        inString = character;
        hasCode = true;
        continue;
      }
      if (!/\s/.test(character)) hasCode = true;
    }
    if (hasCode) lines += 1;
  }
  return lines;
}

describe('file size', () => {
  it('disregards comments and blank lines when measuring source files', () => {
    expect(
      codeLineCount(
        ['', '// Documentation.', '/* More documentation.', ' */', '', 'const item = 1;'].join(
          '\n',
        ),
      ),
    ).toBe(1);
  });

  it('does not let a new file be born above the ceiling', () => {
    const oversized = sourceFiles
      .filter((path) => codeLineCount(readFileSync(path, 'utf8')) > LINE_LIMIT)
      .map(relativeOf)
      .sort();

    expect(oversized).toEqual([...FILES_OVER_THE_LIMIT].sort());
  });
});
