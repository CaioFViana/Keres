import {
  CURRENT_PACK_FORMAT_VERSION,
  validatePackContent,
  type PackContentType,
  type PackSelectionType,
  type PackVisibility,
} from '@keres/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { PackSelect } from '../../db/schema';
import { createULID } from '../../utils/entityUtils';
import {
  buildStoryBundleFromPacks,
  findPackConflicts,
  type NewStoryData,
  type PackConflict,
} from '../../utils/packBundle';
import { createSuggestionService } from './SuggestionService';
import { createStoryService } from './StoryService';

/**
 * Packs: the reusable part of a story's structure.
 *
 * Two operations matter and everything else is bookkeeping around them.
 *
 * **Extraction** reads a story and keeps its *shape* - custom attributes, suggestion
 * catalogues, stat axes and ladders, tags - plus, when the author asks for it, element skeletons
 * as `extras`. Never an `attributeValue`, never a `statRelation`, never gallery bytes: those are
 * the writer's filled-in content, and extras stay skeletons on purpose.
 *
 * **Application** happens only at story creation, and goes through `importFullStory` rather than
 * through the per-entity services. That is what gives the feature its defining property: the import
 * path records **no operations at all**, so a story created from packs starts with an empty log and
 * is bootstrapped to a server whole, by the machinery that already exists. Applying a pack to an
 * existing story is deliberately impossible - see `docs/packs_feature_plan.md`.
 */

export interface PackSummary {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  authorName: string | null;
  version: number;
  sourceStoryId: string | null;
  visibility: PackVisibility;
  updatedAt: Date;
  /** What the pack actually carries, for the listing to describe it without opening the payload. */
  counts: PackContentCounts;
}

export interface PackContentCounts {
  customAttributes: number;
  suggestions: number;
  tags: number;
  stats: number;
  hasVocabulary: boolean;
  extras: {
    chapters: number;
    scenes: number;
    characters: number;
    locations: number;
    worldRules: number;
    notes: number;
    storyBoards: number;
    storyLocationMaps: number;
  };
}

/** A pack as it travels: metadata plus the payload. */
export interface UploadablePack {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  authorName: string | null;
  version: number;
  visibility: PackVisibility;
  content: PackContentType;
}

export interface SavePackInput {
  sourceStoryId: string;
  name: string;
  description?: string | null;
  language?: string | null;
  authorName?: string | null;
  selection: PackSelectionType;
}

export interface PackService {
  listPacks(): Promise<PackSummary[]>;
  getPackContent(packId: string): Promise<PackContentType | null>;
  /** Reads the source story and stores the extracted shape as a new pack. */
  createPack(input: SavePackInput): Promise<string>;
  /** Re-reads the source story with the same selection and bumps `version`. */
  reextractPack(packId: string, selection: PackSelectionType): Promise<void>;
  updatePackDetails(
    packId: string,
    details: {
      name?: string;
      description?: string | null;
      language?: string | null;
      authorName?: string | null;
    },
  ): Promise<void>;
  deletePack(packId: string): Promise<void>;
  extractFromStory(storyId: string, selection: PackSelectionType): Promise<PackContentType>;
  /** What the database would refuse if these packs were applied together. */
  findConflicts(packIds: string[]): Promise<PackConflict[]>;
  /** Everything a shared copy needs, or `null` if the pack is gone or unreadable. */
  getPackForUpload(packId: string): Promise<UploadablePack | null>;
  /**
   * Stores a pack downloaded from a server, replacing any copy already held under that id.
   *
   * It keeps the remote id, so downloading twice updates in place instead of piling up near
   * duplicates. It has no `sourceStoryId`: it was not extracted here, so it cannot be re-extracted -
   * the list offers only deletion for it.
   */
  importRemotePack(pack: UploadablePack): Promise<void>;
  /**
   * Creates the story with the packs already in it, in one import.
   *
   * The only way a pack is ever applied. It goes through `importFullStory`, so it writes no
   * operation log entries and the result is bootstrapped to a server whole - see
   * `utils/packBundle.ts`.
   */
  createStoryWithPacks(
    userId: string,
    story: NewStoryData,
    packIds: string[],
    includeExtras?: boolean | readonly string[],
  ): Promise<string>;
}

/** Whether the pack carries any skeleton at all - the install switch has nothing to offer otherwise. */
export function packHasExtras(counts: PackContentCounts | undefined): boolean {
  if (!counts) return false;
  return Object.values(counts.extras).some((count) => count > 0);
}

export function countPackContent(content: PackContentType): PackContentCounts {
  // Rows written before format v2 have no `extras` key; validation fills it wherever it runs,
  // but this also reads stored rows through the tolerant parse above.
  const extras = content.extras ?? EMPTY_EXTRAS;
  return {
    customAttributes: content.storySchemaFields.length,
    suggestions: content.suggestions.length,
    tags: content.tags.length,
    stats: content.stats.length,
    hasVocabulary: Object.keys(content.settings.vocabulary?.terms ?? {}).length > 0,
    extras: {
      chapters: extras.chapters.length,
      scenes: extras.scenes.length,
      characters: extras.characters.length,
      locations: extras.locations.length,
      worldRules: extras.worldRules.length,
      notes: extras.notes.length,
      storyBoards: extras.storyBoards.length,
      storyLocationMaps: extras.storyLocationMaps.length,
    },
  };
}

/** Tolerates a payload written by a future version rather than breaking the whole listing. */
function parseContent(raw: string): PackContentType | null {
  try {
    return validatePackContent(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to parse pack content:', error);
    return null;
  }
}

const EMPTY_EXTRAS: PackContentType['extras'] = {
  chapters: [],
  scenes: [],
  characters: [],
  locations: [],
  worldRules: [],
  notes: [],
  storyBoards: [],
  storyLocationMaps: [],
  characterScenes: [],
  characterRelations: [],
  locationRelations: [],
  noteRelations: [],
  tagRelations: [],
};

const EMPTY_CONTENT: PackContentType = {
  formatVersion: CURRENT_PACK_FORMAT_VERSION,
  storySchemaFields: [],
  suggestions: [],
  tags: [],
  stats: [],
  statStrengths: [],
  settings: { statSystem: false, statNotation: 'letter' },
  extras: EMPTY_EXTRAS,
};

export const createPackService = (db: AppDrizzleClient): PackService => {
  const suggestionService = createSuggestionService(db);

  async function extractFromStory(
    storyId: string,
    selection: PackSelectionType,
  ): Promise<PackContentType> {
    const story = await db
      .select()
      .from(schema.stories)
      .where(eq(schema.stories.id, storyId))
      .get();
    if (!story) throw new Error(`Story with ID ${storyId} not found for pack extraction.`);

    const content: PackContentType = {
      ...EMPTY_CONTENT,
      settings: { ...EMPTY_CONTENT.settings },
      extras: { ...EMPTY_CONTENT.extras },
    };
    // A pack offers terminology only at story creation. The resulting story owns its copied value.
    content.settings.vocabulary = story.vocabulary;

    if (selection.customAttributes) {
      content.storySchemaFields = await db
        .select()
        .from(schema.storySchemaFields)
        .where(
          and(
            eq(schema.storySchemaFields.storyId, storyId),
            eq(schema.storySchemaFields.isDeleted, false),
          ),
        )
        .all();
    }

    if (selection.tags) {
      content.tags = await db
        .select()
        .from(schema.tags)
        .where(and(eq(schema.tags.storyId, storyId), eq(schema.tags.isDeleted, false)))
        .all();
    }

    if (selection.stats) {
      content.stats = await db
        .select()
        .from(schema.stats)
        .where(and(eq(schema.stats.storyId, storyId), eq(schema.stats.isDeleted, false)))
        .all();
      content.statStrengths = await db
        .select()
        .from(schema.statStrengths)
        .where(
          and(eq(schema.statStrengths.storyId, storyId), eq(schema.statStrengths.isDeleted, false)),
        )
        .all();
      // Carrying the axes without the settings would produce a pack that visibly does nothing: the
      // stats screens stay hidden until `statSystem` is on, and it can only be set at creation.
      content.settings.statSystem = true;
      content.settings.statNotation = story.statNotation as 'letter' | 'number';
    }

    if (selection.suggestions) {
      content.suggestions = await db
        .select()
        .from(schema.suggestions)
        .where(
          and(eq(schema.suggestions.storyId, storyId), eq(schema.suggestions.isDeleted, false)),
        )
        .all();

      if (selection.suggestionsIncludeUsed) {
        content.suggestions = [
          ...content.suggestions,
          ...(await harvestUsedValues(storyId, content)),
        ];
      }

      // A catalogue typed `custom:<fieldId>` is only reachable through the field it belongs to. If
      // the fields were not extracted - the suggestions toggle on, the attributes toggle off - those
      // rows would travel into every story made from this pack and resolve to nothing, which is the
      // same silent orphaning that `cloneExampleStory` shipped for months. Keep the pack
      // self-consistent instead.
      const includedFieldIds = new Set(content.storySchemaFields.map((field) => field.id));
      content.suggestions = content.suggestions.filter(
        (suggestion) =>
          !suggestion.type.startsWith('custom:') ||
          includedFieldIds.has(suggestion.type.slice('custom:'.length)),
      );
    }

    if (selection.extras) {
      content.extras = await harvestExtras(
        storyId,
        content.tags.map((tag) => tag.id),
      );
    }

    return content;
  }

  /**
   * The values the story's entities actually use, as catalogue rows.
   *
   * The `suggestions` table holds only what the writer deliberately saved; everything else is read
   * back from the entities on demand (`getSuggestionUsageCounts` is documented as excluding saved
   * values). Materialising them is what the "include values used in this story" toggle means.
   */
  async function harvestUsedValues(
    storyId: string,
    content: PackContentType,
  ): Promise<PackContentType['suggestions']> {
    const types = new Set<string>(content.suggestions.map((suggestion) => suggestion.type));
    for (const field of content.storySchemaFields) {
      if (field.type === 'suggestion' || field.type === 'suggestion_list') {
        types.add(`custom:${field.id}`);
      }
    }

    const now = new Date();
    const harvested: PackContentType['suggestions'] = [];
    for (const type of types) {
      let used: [string, number][] = [];
      try {
        used = await suggestionService.getSuggestionUsageCounts(type, storyId);
      } catch (error) {
        // A type with no harvestable column (a custom field's catalogue, say) is not an error - it
        // simply has nothing to sweep in beyond what is already stored.
        console.debug(`No harvestable usages for suggestion type ${type}:`, error);
        continue;
      }
      for (const [value] of used) {
        harvested.push({
          id: createULID(),
          storyId,
          type,
          value,
          createdAt: now,
          updatedAt: now,
          version: 1,
          isDeleted: false,
          deletedAt: null,
        });
      }
    }
    return harvested;
  }

  /**
   * Element skeletons for `extras`: every live element row plus the joins whose endpoints travel
   * along. Anything pointing outside the harvest is sanitized the way the target state allows -
   * an optional reference becomes null (an unfiled scene, a scene without a place, a chapter
   * without an arc), join rows are dropped - so harvested content always satisfies the extras
   * integrity rules by construction. Unfiled scenes travel as unfiled, exactly as story export
   * carries them.
   *
   * Two deliberate exceptions: board pins and map nodes keep pointing at deleted locations as
   * ghosts (`labelAtPin` and ghost pins are designed render states), while map background images
   * are dropped outright - gallery bytes never travel in a pack, so an image would have no
   * fallback at all.
   */
  async function harvestExtras(
    storyId: string,
    carriedTagIds: string[],
  ): Promise<PackContentType['extras']> {
    // One where clause for thirteen tables, mirroring the exporter's generic read: every
    // extras table carries `storyId` and soft-delete flags.
    const liveRows = async <T>(table: object): Promise<T[]> => {
      const rows = await db
        .select()
        .from(table as any)
        .where(and(eq((table as any).storyId, storyId), eq((table as any).isDeleted, false)))
        .all();
      return rows as T[];
    };

    type Extras = PackContentType['extras'];
    const chapters = await liveRows<Extras['chapters'][number]>(schema.chapters);
    const scenes = await liveRows<Extras['scenes'][number]>(schema.scenes);
    const characters = await liveRows<Extras['characters'][number]>(schema.characters);
    const locations = await liveRows<Extras['locations'][number]>(schema.locations);
    const worldRules = await liveRows<Extras['worldRules'][number]>(schema.worldRules);
    const notes = await liveRows<Extras['notes'][number]>(schema.notes);
    const storyBoards = await liveRows<Extras['storyBoards'][number]>(schema.boards);
    const storyLocationMaps = await liveRows<Extras['storyLocationMaps'][number]>(
      schema.locationMaps,
    );

    const chapterIds = new Set(chapters.map((row) => row.id));
    const sceneIds = new Set(scenes.map((row) => row.id));
    const characterIds = new Set(characters.map((row) => row.id));
    const locationIds = new Set(locations.map((row) => row.id));
    const worldRuleIds = new Set(worldRules.map((row) => row.id));
    const noteIds = new Set(notes.map((row) => row.id));
    const mapIds = new Set(storyLocationMaps.map((row) => row.id));
    const tagIds = new Set(carriedTagIds);
    const ownersOf = (relationType: string): ReadonlySet<string> | null => {
      switch (relationType) {
        case 'Character':
          return characterIds;
        case 'Location':
          return locationIds;
        case 'Scene':
          return sceneIds;
        case 'Chapter':
          return chapterIds;
        case 'WorldRule':
          return worldRuleIds;
        case 'Note':
          return noteIds;
        default:
          return null;
      }
    };

    const characterScenes = (
      await liveRows<Extras['characterScenes'][number]>(schema.characterScenes)
    ).filter((row) => characterIds.has(row.characterId) && sceneIds.has(row.sceneId));
    const characterRelations = (
      await liveRows<Extras['characterRelations'][number]>(schema.characterRelations)
    ).filter((row) => characterIds.has(row.character1Id) && characterIds.has(row.character2Id));
    const locationRelations = (
      await liveRows<Extras['locationRelations'][number]>(schema.locationRelations)
    ).filter((row) => locationIds.has(row.locationAId) && locationIds.has(row.locationBId));
    const noteRelations = (
      await liveRows<Extras['noteRelations'][number]>(schema.noteRelations)
    ).filter((row) => {
      const owners = ownersOf(row.relationType);
      return noteIds.has(row.noteId) && owners !== null && owners.has(row.relationId);
    });
    const tagRelations = (
      await liveRows<Extras['tagRelations'][number]>(schema.tagRelations)
    ).filter((row) => {
      const owners = ownersOf(row.relationType);
      return tagIds.has(row.tagId) && owners !== null && owners.has(row.relationId);
    });

    return {
      chapters: chapters.map((row) => ({ ...row, arcId: null })),
      scenes: scenes.map((row) => ({
        ...row,
        chapterId: row.chapterId !== null && chapterIds.has(row.chapterId) ? row.chapterId : null,
        locationId:
          row.locationId !== null && locationIds.has(row.locationId) ? row.locationId : null,
      })),
      characters,
      locations,
      worldRules,
      notes,
      storyBoards,
      storyLocationMaps: storyLocationMaps.map((row) => ({
        ...row,
        content: {
          ...row.content,
          images: [],
          nodes: row.content.nodes.map((node) => ({
            ...node,
            destinationMapId:
              node.destinationMapId != null && mapIds.has(node.destinationMapId)
                ? node.destinationMapId
                : null,
          })),
          markers: row.content.markers?.map((marker) => ({
            ...marker,
            destinationMapId:
              marker.destinationMapId != null && mapIds.has(marker.destinationMapId)
                ? marker.destinationMapId
                : null,
          })),
        },
      })),
      characterScenes,
      characterRelations,
      locationRelations,
      noteRelations,
      tagRelations,
    };
  }

  async function loadContents(packIds: string[]): Promise<PackContentType[]> {
    const contents: PackContentType[] = [];
    for (const packId of packIds) {
      const row = await db.select().from(schema.packs).where(eq(schema.packs.id, packId)).get();
      if (!row) throw new Error(`Pack with ID ${packId} not found.`);
      const content = parseContent(row.content);
      if (!content) throw new Error(`Pack "${row.name}" could not be read.`);
      contents.push(content);
    }
    return contents;
  }

  return {
    extractFromStory,

    async listPacks() {
      const rows = await db.select().from(schema.packs).orderBy(desc(schema.packs.updatedAt)).all();
      return rows.map((row: PackSelect) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        language: row.language,
        authorName: row.authorName,
        version: row.version,
        sourceStoryId: row.sourceStoryId,
        visibility: row.visibility,
        updatedAt: row.updatedAt,
        counts: countPackContent(parseContent(row.content) ?? EMPTY_CONTENT),
      }));
    },

    async getPackContent(packId) {
      const row = await db.select().from(schema.packs).where(eq(schema.packs.id, packId)).get();
      return row ? parseContent(row.content) : null;
    },

    async createPack(input) {
      const story = await db
        .select()
        .from(schema.stories)
        .where(eq(schema.stories.id, input.sourceStoryId))
        .get();
      const content = await extractFromStory(input.sourceStoryId, input.selection);
      const now = new Date();
      const id = createULID();

      await db.insert(schema.packs).values({
        id,
        name: input.name.trim(),
        description: input.description ?? null,
        // Prefilled from the story and editable from there, both of them.
        language: input.language ?? story?.language ?? null,
        authorName: input.authorName ?? story?.author ?? null,
        version: 1,
        content: JSON.stringify(content),
        sourceStoryId: input.sourceStoryId,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },

    async reextractPack(packId, selection) {
      const row = await db.select().from(schema.packs).where(eq(schema.packs.id, packId)).get();
      if (!row) throw new Error(`Pack with ID ${packId} not found.`);
      if (!row.sourceStoryId) {
        throw new Error('This pack has no source story on this device; it can only be deleted.');
      }
      const content = await extractFromStory(row.sourceStoryId, selection);
      await db
        .update(schema.packs)
        .set({ content: JSON.stringify(content), version: row.version + 1, updatedAt: new Date() })
        .where(eq(schema.packs.id, packId));
    },

    async updatePackDetails(packId, details) {
      await db
        .update(schema.packs)
        .set({ ...details, updatedAt: new Date() })
        .where(eq(schema.packs.id, packId));
    },

    async getPackForUpload(packId) {
      const row = await db.select().from(schema.packs).where(eq(schema.packs.id, packId)).get();
      if (!row) return null;
      const content = parseContent(row.content);
      if (!content) return null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        language: row.language,
        authorName: row.authorName,
        version: row.version,
        visibility: row.visibility,
        content,
      };
    },

    async importRemotePack(pack) {
      const now = new Date();
      const existing = await db
        .select()
        .from(schema.packs)
        .where(eq(schema.packs.id, pack.id))
        .get();
      const row = {
        name: pack.name,
        description: pack.description,
        language: pack.language,
        authorName: pack.authorName,
        version: pack.version,
        visibility: pack.visibility,
        content: JSON.stringify(pack.content),
        sourceStoryId: null,
        updatedAt: now,
      };
      if (existing) {
        await db.update(schema.packs).set(row).where(eq(schema.packs.id, pack.id));
        return;
      }
      await db.insert(schema.packs).values({ ...row, id: pack.id, createdAt: now });
    },

    async findConflicts(packIds) {
      return findPackConflicts(await loadContents(packIds));
    },

    async createStoryWithPacks(
      userId,
      story,
      packIds,
      includeExtras: boolean | readonly string[] = false,
    ) {
      const contents = await loadContents(packIds);
      const conflicts = findPackConflicts(contents);
      if (conflicts.length > 0) {
        // The picker is where a collision is explained; reaching here means it was bypassed, and
        // letting it through would surface as a constraint violation inside the import transaction.
        throw new Error(
          `Selected packs conflict: ${conflicts.map((conflict) => conflict.detail).join(', ')}`,
        );
      }
      // A boolean decides for every pack at once; a list names the packs whose skeletons install.
      // The composer only understands positions, so the names become flags here.
      const flags =
        typeof includeExtras === 'boolean'
          ? includeExtras
          : packIds.map((packId) => includeExtras.includes(packId));
      return createStoryService(db).importFullStory(
        userId,
        buildStoryBundleFromPacks(story, contents, flags),
        null,
      );
    },

    async deletePack(packId) {
      // A hard delete: a pack is outside the sync engine, so there is nobody to tell about a
      // tombstone and nothing that could resurrect it.
      await db.delete(schema.packs).where(eq(schema.packs.id, packId));
    },
  };
};
