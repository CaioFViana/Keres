import {
  CURRENT_PACK_FORMAT_VERSION,
  PackContentSchema,
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
 * **Extraction** reads a story and keeps only its *shape* - custom attributes, suggestion
 * catalogues, stat axes and ladders, tags. Never an entity, never an `attributeValue`, never a
 * `statRelation`: those are the writer's content, and a pack that carried them would be a story.
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
  createStoryWithPacks(userId: string, story: NewStoryData, packIds: string[]): Promise<string>;
}

export function countPackContent(content: PackContentType): PackContentCounts {
  return {
    customAttributes: content.storySchemaFields.length,
    suggestions: content.suggestions.length,
    tags: content.tags.length,
    stats: content.stats.length,
  };
}

/** Tolerates a payload written by a future version rather than breaking the whole listing. */
function parseContent(raw: string): PackContentType | null {
  try {
    return PackContentSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to parse pack content:', error);
    return null;
  }
}

const EMPTY_CONTENT: PackContentType = {
  formatVersion: CURRENT_PACK_FORMAT_VERSION,
  storySchemaFields: [],
  suggestions: [],
  tags: [],
  stats: [],
  statStrengths: [],
  settings: { statSystem: false, statNotation: 'letter' },
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

    const content: PackContentType = { ...EMPTY_CONTENT, settings: { ...EMPTY_CONTENT.settings } };
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

    async createStoryWithPacks(userId, story, packIds) {
      const contents = await loadContents(packIds);
      const conflicts = findPackConflicts(contents);
      if (conflicts.length > 0) {
        // The picker is where a collision is explained; reaching here means it was bypassed, and
        // letting it through would surface as a constraint violation inside the import transaction.
        throw new Error(
          `Selected packs conflict: ${conflicts.map((conflict) => conflict.detail).join(', ')}`,
        );
      }
      return createStoryService(db).importFullStory(
        userId,
        buildStoryBundleFromPacks(story, contents),
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
