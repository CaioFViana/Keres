import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';

/**
 * Um export com `formatVersion` maior que o suportado por este app - a pessoa importando
 * está numa versão do Keres mais antiga que quem exportou.
 */
export class StoryExportVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryExportVersionError';
  }
}

type StoryExportMigration = {
  fromVersion: number;
  migrate: (data: any) => any;
};

/**
 * V1 -> V2
 *
 * As mudanças reais deste formato são favoritos por entidade, os campos novos de Story e a
 * remoção de `Suggestion.isDefault`, que deixou de ter significado no produto.
 */
const migrateV1ToV2: StoryExportMigration = {
  fromVersion: 1,
  migrate: (data) => {
    const story = data?.story
      ? {
          ...data.story,
          // V1 representava favoritos como estado global da história.
          favoriteBehavior: data.story.favoriteBehavior ?? 'global',
          normalizeSceneTiming: data.story.normalizeSceneTiming ?? false,
        }
      : data?.story;
    const suggestions = Array.isArray(data?.suggestions)
      ? data.suggestions.map((rawSuggestion: any) => {
          const suggestion = { ...rawSuggestion };
          delete suggestion.isDefault;
          return suggestion;
        })
      : data?.suggestions;

    return {
      ...data,
      story,
      suggestions,
      favorites: Array.isArray(data?.favorites) ? data.favorites : [],
    };
  },
};

/** V2 -> V3: comentários de campos e relações bidirecionais "Veja também". */
const migrateV2ToV3: StoryExportMigration = {
  fromVersion: 2,
  migrate: (data) => ({
    ...data,
    comments: Array.isArray(data?.comments) ? data.comments : [],
    seeAlsoRelations: Array.isArray(data?.seeAlsoRelations) ? data.seeAlsoRelations : [],
  }),
};

/** V3 -> V4: grupos/checks de Choice e effects (Scene/Choice). */
const migrateV3ToV4: StoryExportMigration = {
  fromVersion: 3,
  migrate: (data) => ({
    ...data,
    choiceCheckGroups: Array.isArray(data?.choiceCheckGroups) ? data.choiceCheckGroups : [],
    choiceChecks: Array.isArray(data?.choiceChecks) ? data.choiceChecks : [],
    effects: Array.isArray(data?.effects) ? data.effects : [],
  }),
};

const migrations: StoryExportMigration[] = [migrateV1ToV2, migrateV2ToV3, migrateV3ToV4];

/**
 * Normaliza um export bruto (JSON já parseado, ainda não validado pelo `FullStoryExportSchema`)
 * para o formato atual, rodando qualquer migração pendente.
 *
 * Exports de antes deste campo existir não têm `formatVersion` - tratados como versão 0.
 * Deve rodar antes de `FullStoryExportSchema.parse()`, tanto no client quanto na API.
 */
export function migrateStoryExport(raw: any): any {
  const version = typeof raw?.formatVersion === 'number' ? raw.formatVersion : 0;

  if (version > CURRENT_STORY_FORMAT_VERSION) {
    throw new StoryExportVersionError(
      `This story export was created by a newer version of Keres (format ${version}) than this app supports (format ${CURRENT_STORY_FORMAT_VERSION}).`,
    );
  }

  let data = raw;
  for (const migration of migrations
    .filter((m) => m.fromVersion >= version)
    .sort((a, b) => a.fromVersion - b.fromVersion)) {
    data = migration.migrate(data);
  }

  // `individual` is the default only for stories created from now on. Exports written
  // before favorite behavior existed represented the former global behavior, so importing
  // one must not silently change its semantics merely because the schema now has a new default.
  if (data?.story && data.story.favoriteBehavior === undefined) {
    data = { ...data, story: { ...data.story, favoriteBehavior: 'global' } };
  }

  return { ...data, formatVersion: CURRENT_STORY_FORMAT_VERSION };
}
