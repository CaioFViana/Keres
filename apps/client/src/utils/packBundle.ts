import {
  type ArcMedium,
  CURRENT_STORY_FORMAT_VERSION,
  DEFAULT_ARC_MEDIUM,
  DEFAULT_CHAPTER_TYPE,
  type FullStoryExportType,
  MAX_PRIMARY_STATS,
  type PackContentType,
  type Story,
} from '@keres/shared';
import { createULID } from './entityUtils';

/**
 * Turning a new story plus the packs chosen for it into an import bundle.
 *
 * Applying packs is not a write path of its own: the bundle produced here goes through
 * `cloneStoryForLocalImport` and `importFullStory`, exactly like importing a `.json`. That is what
 * gives the feature its defining property - the import path records **no operations at all**, so a
 * story created from packs starts with an empty log and is bootstrapped to a server whole. It also
 * means the ids are remapped by machinery that already exists, including the `custom:<fieldId>`
 * suggestion types that would otherwise be orphaned.
 *
 * Pure on purpose: no database, no React. The conflicts below are the only thing standing between a
 * picker's happy click and a constraint violation deep inside a transaction.
 */

/** A story about to be created, before it has an id or timestamps. */
export type NewStoryData = Omit<
  Story,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
  | 'isDeleted'
  | 'deletedAt'
  | 'serverId'
  | 'timelineEpochSeconds'
  | 'vocabulary'
  | 'coverGalleryId'
> & {
  timelineEpochSeconds?: number | null;
  vocabulary?: Story['vocabulary'];
  coverGalleryId?: Story['coverGalleryId'];
};

export type PackConflictKind =
  | 'attribute_key'
  | 'tag_name'
  | 'suggestion_value'
  | 'default_ladder'
  | 'primary_stat_limit';

export interface PackConflict {
  kind: PackConflictKind;
  /** The colliding value, for the picker to name it rather than say "there was a problem". */
  detail: string;
}

const PLACEHOLDER_STORY_ID = 'PACKSTORYPLACEHOLDER000000';

/**
 * Gives one pack's extras fresh row ids so merged packs never collide, rewriting every internal
 * reference to match. Tag ids are left alone: tags travel outside extras and keep their own ids.
 */
function rekeyExtras(extras: PackContentType['extras']): PackContentType['extras'] {
  // Two passes: every row gets its fresh id before any reference is rewritten, so a scene's
  // location resolves even though scenes are listed before locations, and a map can point at a
  // map listed after it.
  const freshByOld = new Map<string, string>();
  for (const row of [
    ...extras.chapters,
    ...extras.scenes,
    ...extras.characters,
    ...extras.locations,
    ...extras.worldRules,
    ...extras.notes,
    ...extras.storyBoards,
    ...extras.storySketches,
    ...extras.storyLocationMaps,
    ...extras.characterScenes,
    ...extras.characterRelations,
    ...extras.locationRelations,
    ...extras.noteRelations,
    ...extras.tagRelations,
  ]) {
    if (!freshByOld.has(row.id)) freshByOld.set(row.id, createULID());
  }
  const fresh = (id: string): string => freshByOld.get(id) ?? id;
  const link = (id: string | null): string | null =>
    id === null ? null : (freshByOld.get(id) ?? id);

  return {
    chapters: extras.chapters.map((row) => ({ ...row, id: fresh(row.id) })),
    scenes: extras.scenes.map((row) => ({
      ...row,
      id: fresh(row.id),
      chapterId: link(row.chapterId) ?? row.chapterId,
      locationId: link(row.locationId),
    })),
    characters: extras.characters.map((row) => ({ ...row, id: fresh(row.id) })),
    locations: extras.locations.map((row) => ({ ...row, id: fresh(row.id) })),
    worldRules: extras.worldRules.map((row) => ({ ...row, id: fresh(row.id) })),
    notes: extras.notes.map((row) => ({ ...row, id: fresh(row.id) })),
    storyBoards: extras.storyBoards.map((row) => ({
      ...row,
      id: fresh(row.id),
      content: {
        ...row.content,
        nodes: row.content.nodes.map((node) =>
          node.kind === 'entity'
            ? { ...node, entityId: link(node.entityId) ?? node.entityId }
            : node,
        ),
      },
    })),
    // Packs carry no gallery media, so a sketch's snapshot cover cannot follow: it clears.
    storySketches: extras.storySketches.map((row) => ({
      ...row,
      id: fresh(row.id),
      coverGalleryId: null,
    })),
    storyLocationMaps: extras.storyLocationMaps.map((row) => ({
      ...row,
      id: fresh(row.id),
      content: {
        ...row.content,
        nodes: row.content.nodes.map((node) => ({
          ...node,
          locationId: link(node.locationId) ?? node.locationId,
          destinationMapId:
            node.destinationMapId != null && freshByOld.has(node.destinationMapId)
              ? (link(node.destinationMapId) as string)
              : null,
        })),
        markers: row.content.markers?.map((marker) => ({
          ...marker,
          destinationMapId:
            marker.destinationMapId != null && freshByOld.has(marker.destinationMapId)
              ? (link(marker.destinationMapId) as string)
              : null,
        })),
        relationTexts: row.content.relationTexts?.map((text) => ({
          ...text,
          sourceLocationId: link(text.sourceLocationId) ?? text.sourceLocationId,
          destinationLocationId: link(text.destinationLocationId) ?? text.destinationLocationId,
        })),
      },
    })),
    characterScenes: extras.characterScenes.map((row) => ({
      ...row,
      id: fresh(row.id),
      characterId: link(row.characterId) ?? row.characterId,
      sceneId: link(row.sceneId) ?? row.sceneId,
    })),
    characterRelations: extras.characterRelations.map((row) => ({
      ...row,
      id: fresh(row.id),
      character1Id: link(row.character1Id) ?? row.character1Id,
      character2Id: link(row.character2Id) ?? row.character2Id,
    })),
    locationRelations: extras.locationRelations.map((row) => ({
      ...row,
      id: fresh(row.id),
      locationAId: link(row.locationAId) ?? row.locationAId,
      locationBId: link(row.locationBId) ?? row.locationBId,
    })),
    noteRelations: extras.noteRelations.map((row) => ({
      ...row,
      id: fresh(row.id),
      noteId: link(row.noteId) ?? row.noteId,
      relationId: link(row.relationId) ?? row.relationId,
    })),
    tagRelations: extras.tagRelations.map((row) => ({
      ...row,
      id: fresh(row.id),
      relationId: link(row.relationId) ?? row.relationId,
    })),
  };
}

/** Packs written before format v2 carry no `extras` key; they compose as carrying nothing extra. */
const EMPTY_EXTRAS: PackContentType['extras'] = {
  chapters: [],
  scenes: [],
  characters: [],
  locations: [],
  worldRules: [],
  notes: [],
  storyBoards: [],
  storySketches: [],
  storyLocationMaps: [],
  characterScenes: [],
  characterRelations: [],
  locationRelations: [],
  noteRelations: [],
  tagRelations: [],
};

/**
 * What the database would refuse if these packs were applied together.
 *
 * Every one of these is a real constraint, not a policy invented here:
 * `unique(storyId, entityType, key)` on the schema fields, `unique(storyId, name)` on live tags,
 * `unique(storyId, type, value)` on live suggestions, one default ladder per story, and the twelve
 * primary stats the radar and the server both enforce.
 *
 * A single pack cannot collide with itself - its source story satisfied the same constraints - so
 * everything here only happens when several are chosen at once.
 */
export function findPackConflicts(contents: PackContentType[]): PackConflict[] {
  const conflicts: PackConflict[] = [];
  const seenKeys = new Set<string>();
  const seenTags = new Set<string>();
  const seenSuggestions = new Set<string>();
  let defaultLadders = 0;
  let primaryStats = 0;

  for (const content of contents) {
    for (const field of content.storySchemaFields) {
      const key = `${field.entityType}:${field.key}`;
      if (seenKeys.has(key)) {
        conflicts.push({ kind: 'attribute_key', detail: `${field.entityType} · ${field.key}` });
      }
      seenKeys.add(key);
    }
    for (const tag of content.tags) {
      if (seenTags.has(tag.name)) conflicts.push({ kind: 'tag_name', detail: tag.name });
      seenTags.add(tag.name);
    }
    for (const suggestion of content.suggestions) {
      const key = `${suggestion.type} ${suggestion.value}`;
      if (seenSuggestions.has(key)) {
        conflicts.push({ kind: 'suggestion_value', detail: suggestion.value });
      }
      seenSuggestions.add(key);
    }
    // A ladder with no `statId` is the story's default; two of them leave the fallback undefined.
    defaultLadders += content.statStrengths.some((tier) => tier.statId === null) ? 1 : 0;
    primaryStats += content.stats.filter((stat) => stat.isPrimary).length;
  }

  if (defaultLadders > 1) {
    conflicts.push({ kind: 'default_ladder', detail: String(defaultLadders) });
  }
  if (primaryStats > MAX_PRIMARY_STATS) {
    conflicts.push({ kind: 'primary_stat_limit', detail: String(primaryStats) });
  }
  return conflicts;
}

/**
 * Assembles the bundle. Assumes `findPackConflicts` came back empty - the picker is where a
 * collision is explained, not a transaction rollback.
 *
 * Every id in here is a placeholder: `cloneStoryForLocalImport` replaces the lot, and the rows carry
 * the source story's ids only because that is the shape the export schema already validates.
 *
 * Extras ride the same bundle when `includeExtras` says so - one boolean for every pack, or a
 * per-pack flag list in the same order as `contents`. They cannot conflict the way schema keys
 * can - element rows are keyed by remapped ids, never by name - so two packs' skeletons simply
 * merge, with chapter names suffixed when two packs ship the same one. Chapter order across packs
 * is concatenation: each pack's containers append after the previous pack's, and indices are
 * renumbered 1..N separately for chapters and events. Rows written before format v2 have no
 * `extras` key at all and behave exactly as if the flag were off.
 *
 * Each pack's extras are re-keyed before merging: two packs extracted from the same story carry the
 * same row ids, and the import would read them as one row twice. Fresh ULIDs per pack keep every
 * row distinct while internal references are rewritten to match; references to rows the pack does
 * not carry (board ghosts) keep their stale ids, exactly as the later remap would leave them.
 */
export function buildStoryBundleFromPacks(
  story: NewStoryData,
  contents: PackContentType[],
  includeExtras: boolean | readonly boolean[] = false,
  options: { arcMedium?: ArcMedium } = {},
): FullStoryExportType {
  const now = new Date();
  // The import writes no operations, so the story's one Arc travels in the bundle - in the form of
  // the work the author chose - and every chapter a pack brings belongs to it.
  const defaultArcId = createULID();
  const settings = contents.reduce(
    (applied, content) =>
      content.settings.statSystem || content.settings.vocabulary
        ? {
            statSystem: content.settings.statSystem ? true : applied.statSystem,
            statNotation: content.settings.statSystem
              ? content.settings.statNotation
              : applied.statNotation,
            // The first selected pack that supplies terminology wins. Packs are only applied while
            // creating a story, so this is a deliberate initial suggestion, never a live dependency.
            vocabulary: applied.vocabulary ?? content.settings.vocabulary ?? null,
          }
        : applied,
    {
      statSystem: story.statSystem,
      statNotation: story.statNotation,
      vocabulary: story.vocabulary ?? null,
    },
  );

  const flags =
    typeof includeExtras === 'boolean'
      ? contents.map(() => includeExtras)
      : contents.map((_, index) => includeExtras[index] ?? false);
  const extras = contents.map((content, index) =>
    flags[index] ? rekeyExtras(content.extras ?? EMPTY_EXTRAS) : EMPTY_EXTRAS,
  );
  // Packs append in selection order; within a pack the pack's own indices decide, so a pack
  // whose rows arrive out of order still composes in the order its author arranged. Chapters and
  // events count separate 1..N spaces, exactly as they do in a live story - without this, two
  // packs would land with the same indices and the story's order would be an accident of
  // insertion. Scenes need no such rule: chapters never merge, so a scene's per-chapter index
  // stays valid wherever its chapter lands.
  const mergedChapters = extras.flatMap((extra, packPosition) =>
    extra.chapters.map((chapter, positionInPack) => ({ chapter, packPosition, positionInPack })),
  );
  mergedChapters.sort(
    (a, b) =>
      a.packPosition - b.packPosition ||
      (a.chapter.index ?? Number.MAX_SAFE_INTEGER) - (b.chapter.index ?? Number.MAX_SAFE_INTEGER) ||
      a.positionInPack - b.positionInPack,
  );
  const usedChapterNames = new Set<string>();
  const nextIndexByKind = new Map<string, number>();
  const chapters = mergedChapters.map((row) => {
    let name = row.chapter.name;
    for (let suffix = 2; usedChapterNames.has(name); suffix += 1) {
      name = `${row.chapter.name} (${suffix})`;
    }
    usedChapterNames.add(name);
    const kind = row.chapter.type ?? DEFAULT_CHAPTER_TYPE;
    const index = nextIndexByKind.get(kind) ?? 1;
    nextIndexByKind.set(kind, index + 1);
    return { ...row.chapter, name, index, arcId: defaultArcId };
  });

  return {
    story: {
      ...story,
      timelineEpochSeconds: story.timelineEpochSeconds ?? null,
      ...settings,
      id: PLACEHOLDER_STORY_ID,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    },
    storyArcs: [
      {
        id: defaultArcId,
        storyId: PLACEHOLDER_STORY_ID,
        title: 'Arc',
        description: null,
        sortOrder: 0,
        color: null,
        icon: null,
        themeOverride: null,
        medium: options.arcMedium ?? DEFAULT_ARC_MEDIUM,
        vocabulary: null,
        author: null,
        coverGalleryId: null,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      },
    ],
    chapters,
    scenes: extras.flatMap((extra) => extra.scenes),
    choices: [],
    characters: extras.flatMap((extra) => extra.characters),
    locations: extras.flatMap((extra) => extra.locations),
    worldRules: extras.flatMap((extra) => extra.worldRules),
    notes: extras.flatMap((extra) => extra.notes),
    noteRelations: extras.flatMap((extra) => extra.noteRelations),
    tags: contents.flatMap((content) => content.tags),
    tagRelations: extras.flatMap((extra) => extra.tagRelations),
    suggestions: contents.flatMap((content) => content.suggestions),
    characterRelations: extras.flatMap((extra) => extra.characterRelations),
    characterScenes: extras.flatMap((extra) => extra.characterScenes),
    plots: [],
    plotScenes: [],
    galleryItems: [],
    galleryRelations: [],
    items: [],
    itemJourneys: [],
    storySchemaFields: contents.flatMap((content) => content.storySchemaFields),
    // Never: an attribute value belongs to an entity's filled-in form, not to a skeleton.
    attributeValues: [],
    favorites: [],
    comments: [],
    seeAlsoRelations: [],
    locationRelations: extras.flatMap((extra) => extra.locationRelations),
    choiceCheckGroups: [],
    choiceChecks: [],
    effects: [],
    stats: contents.flatMap((content) => content.stats),
    statStrengths: contents.flatMap((content) => content.statStrengths),
    // Never: a stat value belongs to a character.
    statRelations: [],
    modes: [],
    storyBoards: extras.flatMap((extra) => extra.storyBoards),
    storySketches: extras.flatMap((extra) => extra.storySketches),
    storyLocationMaps: extras.flatMap((extra) => extra.storyLocationMaps),
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
  } as FullStoryExportType;
}
