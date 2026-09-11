import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';

/**
 * An export whose `formatVersion` is greater than this app supports - the person importing is on an
 * older version of Keres than whoever exported.
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
 * This format's real changes are per-entity favourites, Story's new fields and the removal of
 * `Suggestion.isDefault`, which stopped meaning anything in the product.
 */
const migrateV1ToV2: StoryExportMigration = {
  fromVersion: 1,
  migrate: (data) => {
    const story = data?.story
      ? {
          ...data.story,
          // V1 represented favourites as global story state.
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

/** V2 -> V3: per-field comments and bidirectional "See also" relations. */
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

/** V4 -> V5: sistema de status (stats, escadas, valores) e modos de personagem. */
const migrateV4ToV5: StoryExportMigration = {
  fromVersion: 4,
  migrate: (data) => ({
    ...data,
    story: data?.story
      ? {
          ...data.story,
          // Earlier packages had no such system; importing them must not switch the feature on.
          statSystem: data.story.statSystem ?? false,
          statNotation: data.story.statNotation ?? 'letter',
        }
      : data?.story,
    stats: Array.isArray(data?.stats) ? data.stats : [],
    statStrengths: Array.isArray(data?.statStrengths) ? data.statStrengths : [],
    statRelations: Array.isArray(data?.statRelations) ? data.statRelations : [],
    modes: Array.isArray(data?.modes) ? data.modes : [],
  }),
};

/** V5 -> V6: plots and their links to scenes. */
const migrateV5ToV6: StoryExportMigration = {
  fromVersion: 5,
  migrate: (data) => ({
    ...data,
    plots: Array.isArray(data?.plots) ? data.plots : [],
    plotScenes: Array.isArray(data?.plotScenes) ? data.plotScenes : [],
  }),
};

/**
 * V6 -> V7
 *
 * Where each container sits on the story's timeline, which is what makes an event more than a
 * chapter without a number. A package written before them simply has none - the story it describes
 * had no way to say when anything happened.
 */
const migrateV6ToV7: StoryExportMigration = {
  fromVersion: 6,
  migrate: (data) => ({
    ...data,
    chapterAnchors: Array.isArray(data?.chapterAnchors) ? data.chapterAnchors : [],
  }),
};

/**
 * V7 -> V8
 *
 * The story's own calendars. A package written before them has none, which is exactly right: it
 * describes a story that counted time in the app's Gregorian approximations because there was
 * nothing else to count it in.
 */
const migrateV7ToV8: StoryExportMigration = {
  fromVersion: 7,
  migrate: (data) => ({
    ...data,
    storyCalendars: Array.isArray(data?.storyCalendars) ? data.storyCalendars : [],
  }),
};

/** V8 -> V9: configurable terminology plus authored branching Routes and their ordered visits. */
const migrateV8ToV9: StoryExportMigration = {
  fromVersion: 8,
  migrate: (data) => ({
    ...data,
    story: data?.story ? { ...data.story, vocabulary: data.story.vocabulary ?? null } : data?.story,
    routes: Array.isArray(data?.routes) ? data.routes : [],
    routeSteps: Array.isArray(data?.routeSteps) ? data.routeSteps : [],
  }),
};

/**
 * V9 -> V10: Story Arcs and the Arc assignment of every chapter/event.
 *
 * Arcs were introduced after V9 had already been written to disk and to servers.  A legacy story
 * therefore needs one stable destination before its containers can be assigned. The generated id
 * is deterministic and collision-free within the package, so re-reading the same backup produces
 * the same Arc graph before the client imports it.
 */
const migrateV9ToV10: StoryExportMigration = {
  fromVersion: 9,
  migrate: (data) => {
    const storyId = typeof data?.story?.id === 'string' ? data.story.id : undefined;
    if (!storyId) return data;

    const suppliedArcs = Array.isArray(data?.storyArcs) ? data.storyArcs : [];
    const occupiedIds = new Set<string>([storyId]);
    for (const value of Object.values(data ?? {})) {
      if (!Array.isArray(value)) continue;
      for (const row of value) {
        if (typeof row?.id === 'string') occupiedIds.add(row.id);
      }
    }

    const defaultArcId = () => {
      const base = `arc:${storyId}:default`;
      let candidate = base;
      let suffix = 1;
      while (occupiedIds.has(candidate)) candidate = `${base}:${suffix++}`;
      return candidate;
    };

    let storyArcs = suppliedArcs.map((arc: any) => ({ ...arc }));
    if (!storyArcs.length) {
      storyArcs = [
        {
          id: defaultArcId(),
          storyId,
          title: 'Arc',
          description: null,
          sortOrder: 0,
          color: null,
          icon: null,
          themeOverride: null,
          isDefault: true,
          ...(data.story.createdAt === undefined ? {} : { createdAt: data.story.createdAt }),
          ...(data.story.updatedAt === undefined ? {} : { updatedAt: data.story.updatedAt }),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        },
      ];
    } else if (!storyArcs.some((arc: any) => arc?.isDefault === true)) {
      storyArcs[0] = { ...storyArcs[0], isDefault: true };
    }

    const fallbackArcId =
      storyArcs.find((arc: any) => arc?.isDefault === true)?.id ?? storyArcs[0].id;
    const chapters = Array.isArray(data?.chapters)
      ? data.chapters.map((chapter: any) =>
          chapter?.arcId === null || chapter?.arcId === undefined
            ? { ...chapter, arcId: fallbackArcId }
            : chapter,
        )
      : data?.chapters;

    return {
      ...data,
      storyArcs,
      ...(Array.isArray(data?.chapters) ? { chapters } : {}),
    };
  },
};

const migrations: StoryExportMigration[] = [
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  migrateV5ToV6,
  migrateV6ToV7,
  migrateV7ToV8,
  migrateV8ToV9,
  migrateV9ToV10,
];

/**
 * Normalises a raw export (already-parsed JSON, not yet validated by `FullStoryExportSchema`) to
 * the current format, running any pending migration.
 *
 * Exports predating this field have no `formatVersion` - they are treated as version 0. It must run
 * before `FullStoryExportSchema.parse()`, both in the client and in the API.
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
