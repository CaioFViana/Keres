import { z } from 'zod';
import { BoardSchema } from './BoardSchemas';
import { ChapterSchema } from './ChapterSchemas';
import { CharacterRelationSchema } from './CharacterRelationSchemas';
import { CharacterSceneSchema } from './CharacterSceneSchemas';
import { CharacterSchema } from './CharacterSchemas';
import { LocationMapSchema } from './LocationMapSchemas';
import { LocationRelationSchema } from './LocationRelationSchemas';
import { LocationSchema } from './LocationSchemas';
import { NoteRelationSchema } from './NoteRelationSchemas';
import { NoteSchema } from './NoteSchemas';
import { migratePackContent } from './packContentMigrations';
import { ShowcaseOwnerSchema } from './PublicationSchemas';
import { SceneSchema } from './SceneSchemas';
import { StatNotationSchema, StoryVocabularySchema } from './StorySchemas';
import { StatSchema, StatStrengthSchema } from './StatSchemas';
import { StorySchemaFieldSchema } from './StorySchemaFieldSchemas';
import { SuggestionSchema } from './SuggestionSchemas';
import { TagRelationSchema } from './TagRelationSchemas';
import { TagSchema } from './TagSchemas';
import { WorldRuleSchema } from './WorldRuleSchemas';
import { UlidSchema } from './SyncSchemas';
import { CURRENT_PACK_FORMAT_VERSION } from '../metadata/ReleaseVersions';

/**
 * A pack: the reusable part of a story, applied to a new story at creation.
 *
 * The schema is deliberately narrow - custom attributes, suggestion catalogues, stat axes and
 * their ladders, tags. `extras` optionally carries element skeletons on top: chapters, scenes,
 * characters, locations, world rules, notes, boards, location maps, and their join rows. What a
 * pack still never carries is per-entity wiring and media: no `attributeValues`, no
 * `statRelations`, no gallery bytes, no choices, items, modes, calendars, plots or routes.
 *
 * The rows are whole entities rather than a reduced shape on purpose. They then satisfy the same
 * schemas the story export already uses, and applying a pack can go through the very same
 * remap-and-import path (`cloneStoryForLocalImport` -> `importFullStory`), which is also what makes
 * it record no operations - see `docs/packs_feature_plan.md` §3.
 */
/**
 * Re-exported here because this is where importers expect to find it, and where the format it
 * describes is defined. The number itself lives in `metadata/ReleaseVersions.ts` alongside the
 * other constants a release bumps by hand.
 */
export { CURRENT_PACK_FORMAT_VERSION };

/**
 * Story settings a pack may set. Only meaningful at creation - `statSystem` cannot be turned on
 * halfway through a story by a pack, because a pack is never applied to an existing one.
 */
export const PackSettingsSchema = z.object({
  statSystem: z.boolean().default(false),
  statNotation: StatNotationSchema.default('letter'),
  /** Optional terminology offered when a new story is created from this pack. */
  vocabulary: StoryVocabularySchema.nullable().optional(),
});

/**
 * Element skeletons a pack carries alongside its schema ("Adicionais").
 *
 * Every row satisfies the same schema the story export uses, so extras flow into the bundle's
 * element collections untouched. Board and map content internals are deliberately unchecked here:
 * pins to entities the pack does not carry stay ghosts by design (see `remapBoardContent`), while
 * database joins below must resolve - a dangling join row breaks queries, a ghost pin merely
 * renders as one.
 */
export const PackExtrasSchema = z.object({
  chapters: z.array(ChapterSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  characters: z.array(CharacterSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  worldRules: z.array(WorldRuleSchema).default([]),
  notes: z.array(NoteSchema).default([]),
  storyBoards: z.array(BoardSchema).default([]),
  storyLocationMaps: z.array(LocationMapSchema).default([]),
  characterScenes: z.array(CharacterSceneSchema).default([]),
  characterRelations: z.array(CharacterRelationSchema).default([]),
  locationRelations: z.array(LocationRelationSchema).default([]),
  noteRelations: z.array(NoteRelationSchema).default([]),
  tagRelations: z.array(TagRelationSchema).default([]),
});

export type PackExtrasType = z.infer<typeof PackExtrasSchema>;

/** Entity types an extras join may point at: exactly the element rows a pack carries. */
const EXTRAS_OWNERS = ['Character', 'Location', 'Scene', 'Chapter', 'WorldRule', 'Note'] as const;

function ownerIdsOf(extras: PackExtrasType, relationType: string): ReadonlySet<string> | null {
  switch (relationType) {
    case 'Character':
      return new Set(extras.characters.map((row) => row.id));
    case 'Location':
      return new Set(extras.locations.map((row) => row.id));
    case 'Scene':
      return new Set(extras.scenes.map((row) => row.id));
    case 'Chapter':
      return new Set(extras.chapters.map((row) => row.id));
    case 'WorldRule':
      return new Set(extras.worldRules.map((row) => row.id));
    case 'Note':
      return new Set(extras.notes.map((row) => row.id));
    default:
      return null;
  }
}

export const PackContentSchema = z
  .object({
    formatVersion: z.number().int().min(1).default(CURRENT_PACK_FORMAT_VERSION),
    storySchemaFields: z.array(StorySchemaFieldSchema).default([]),
    suggestions: z.array(SuggestionSchema).default([]),
    tags: z.array(TagSchema).default([]),
    stats: z.array(StatSchema).default([]),
    statStrengths: z.array(StatStrengthSchema).default([]),
    settings: PackSettingsSchema.default({ statSystem: false, statNotation: 'letter' }),
    extras: PackExtrasSchema.default({
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
    }),
  })
  .superRefine((content, context) => {
    const fieldIds = new Set(content.storySchemaFields.map((field) => field.id));
    for (const [index, suggestion] of content.suggestions.entries()) {
      if (
        suggestion.type.startsWith('custom:') &&
        !fieldIds.has(suggestion.type.slice('custom:'.length))
      ) {
        context.addIssue({
          code: 'custom',
          path: ['suggestions', index, 'type'],
          message: 'A custom suggestion must refer to a field carried by this pack.',
        });
      }
    }

    const statIds = new Set(content.stats.map((stat) => stat.id));
    for (const [index, tier] of content.statStrengths.entries()) {
      if (tier.statId !== null && !statIds.has(tier.statId)) {
        context.addIssue({
          code: 'custom',
          path: ['statStrengths', index, 'statId'],
          message: 'A stat tier must refer to a stat carried by this pack.',
        });
      }
    }

    const extras = content.extras;
    const chapterIds = new Set(extras.chapters.map((row) => row.id));
    const sceneIds = new Set(extras.scenes.map((row) => row.id));
    const characterIds = new Set(extras.characters.map((row) => row.id));
    const locationIds = new Set(extras.locations.map((row) => row.id));
    const noteIds = new Set(extras.notes.map((row) => row.id));
    const tagIds = new Set(content.tags.map((row) => row.id));

    for (const [index, chapter] of extras.chapters.entries()) {
      // Arcs are never carried: extraction stores them as unfiled chapters.
      if (chapter.arcId !== null && chapter.arcId !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'chapters', index, 'arcId'],
          message: 'A carried chapter must not belong to an arc: packs carry no arcs.',
        });
      }
    }

    for (const [index, scene] of extras.scenes.entries()) {
      // Null travels: unfiled scenes are carried as unfiled, exactly as story export carries
      // them. Only a filing the pack does not carry is rejected.
      if (scene.chapterId !== null && !chapterIds.has(scene.chapterId)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'scenes', index, 'chapterId'],
          message: 'A carried scene must belong to a chapter carried by this pack.',
        });
      }
      if (scene.locationId !== null && !locationIds.has(scene.locationId)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'scenes', index, 'locationId'],
          message: 'A carried scene must point at a location carried by this pack.',
        });
      }
    }

    for (const [index, row] of extras.characterScenes.entries()) {
      if (!characterIds.has(row.characterId) || !sceneIds.has(row.sceneId)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'characterScenes', index],
          message: 'A carried character-scene link must join a carried character and scene.',
        });
      }
    }

    for (const [index, row] of extras.characterRelations.entries()) {
      if (!characterIds.has(row.character1Id) || !characterIds.has(row.character2Id)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'characterRelations', index],
          message: 'A carried character relation must join characters carried by this pack.',
        });
      }
    }

    for (const [index, row] of extras.locationRelations.entries()) {
      if (!locationIds.has(row.locationAId) || !locationIds.has(row.locationBId)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'locationRelations', index],
          message: 'A carried location relation must join locations carried by this pack.',
        });
      }
    }

    for (const [index, row] of extras.noteRelations.entries()) {
      const owners = ownerIdsOf(extras, row.relationType);
      if (!noteIds.has(row.noteId) || owners === null || !owners.has(row.relationId)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'noteRelations', index],
          message:
            'A carried note relation must join a carried note to a carried element ' +
            `(${EXTRAS_OWNERS.join(', ')})).`,
        });
      }
    }

    for (const [index, row] of extras.tagRelations.entries()) {
      const owners = ownerIdsOf(extras, row.relationType);
      if (!tagIds.has(row.tagId) || owners === null || !owners.has(row.relationId)) {
        context.addIssue({
          code: 'custom',
          path: ['extras', 'tagRelations', index],
          message:
            'A carried tag relation must join a carried tag to a carried element ' +
            `(${EXTRAS_OWNERS.join(', ')})).`,
        });
      }
    }
  });

export type PackContentType = z.infer<typeof PackContentSchema>;

/**
 * The one runtime boundary for a Pack's JSON document, shared by client and server.
 *
 * Migration runs first, mirroring story imports: a v1 payload without `extras` arrives here
 * unharmed, and a payload newer than this app fails with a version error instead of silently
 * losing the keys zod would strip.
 */
export function validatePackContent(content: unknown): PackContentType {
  return PackContentSchema.parse(migratePackContent(content));
}

/** What the author chose to extract. Stored so re-extraction can start from the same answers. */
export const PackSelectionSchema = z.object({
  customAttributes: z.boolean().default(false),
  suggestions: z.boolean().default(false),
  /** Also harvest values used by the story's entities, not just its curated catalogue. See §5.1. */
  suggestionsIncludeUsed: z.boolean().default(false),
  stats: z.boolean().default(false),
  tags: z.boolean().default(false),
  /** Also harvest element skeletons (chapters, scenes, characters, …) as `extras`. */
  extras: z.boolean().default(false),
});

export type PackSelectionType = z.infer<typeof PackSelectionSchema>;

/**
 * Whether a shared pack is offered on the server's public Showcase.
 *
 * `private` is the default and the important one: uploading a pack to a server is how it reaches
 * your own other devices and your collaborators, which is a different act from putting it on a page
 * anyone can read. The author raises the flag deliberately, the same way publishing a story is
 * deliberate.
 *
 * No `password` state, unlike a story publication: a pack is structure - field names, stat axes,
 * tag names - never the writer's story, so there is nothing in it that a password would protect. It
 * stays addable later without changing what exists.
 */
export const PackVisibilitySchema = z.enum(['private', 'public']);
export type PackVisibility = z.infer<typeof PackVisibilitySchema>;

export const PackSchema = z.object({
  id: UlidSchema,
  name: z.string().min(1, 'Name cannot be empty'),
  description: z.string().nullable().optional(),
  /**
   * Copied from the source story's own `language`, editable afterwards. Free text and never
   * translated: it is the author's word, like a story title. The listing shows it instead of
   * offering a language selector.
   */
  language: z.string().nullable().optional(),
  /** Copied from the source story's `author`, editable. Display only. */
  authorName: z.string().nullable().optional(),
  version: z.number().int().min(1).default(1),
  visibility: PackVisibilitySchema.default('private'),
  content: PackContentSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PackType = z.infer<typeof PackSchema>;

/**
 * What a pack contains, in numbers.
 *
 * The public listing needs to say something truthful about a pack without shipping its payload -
 * "eleven fields, four stat axes" is the whole reason somebody clicks. Computed from the content
 * rather than stored: a pack is replaced wholesale by its author, so a stored count is one more
 * thing that can silently disagree with the payload it describes.
 */
export const PackContentSummarySchema = z.object({
  fieldCount: z.number().int(),
  suggestionCount: z.number().int(),
  tagCount: z.number().int(),
  statCount: z.number().int(),
  hasVocabulary: z.boolean(),
  statSystem: z.boolean(),
  statNotation: StatNotationSchema,
  chapterCount: z.number().int(),
  sceneCount: z.number().int(),
  characterCount: z.number().int(),
  locationCount: z.number().int(),
  worldRuleCount: z.number().int(),
  noteCount: z.number().int(),
  boardCount: z.number().int(),
  locationMapCount: z.number().int(),
});

export type PackContentSummary = z.infer<typeof PackContentSummarySchema>;

export function summarizePackContent(content: PackContentType): PackContentSummary {
  // `extras` may be absent at runtime on rows written before format v2: the migration fills it
  // wherever validation runs, but summary callers also read stored rows directly.
  const extras = content.extras ?? {
    chapters: [],
    scenes: [],
    characters: [],
    locations: [],
    worldRules: [],
    notes: [],
    storyBoards: [],
    storyLocationMaps: [],
  };
  return {
    fieldCount: content.storySchemaFields.length,
    suggestionCount: content.suggestions.length,
    tagCount: content.tags.length,
    statCount: content.stats.length,
    hasVocabulary: Object.keys(content.settings.vocabulary?.terms ?? {}).length > 0,
    statSystem: content.settings.statSystem,
    statNotation: content.settings.statNotation,
    chapterCount: extras.chapters.length,
    sceneCount: extras.scenes.length,
    characterCount: extras.characters.length,
    locationCount: extras.locations.length,
    worldRuleCount: extras.worldRules.length,
    noteCount: extras.notes.length,
    boardCount: extras.storyBoards.length,
    locationMapCount: extras.storyLocationMaps.length,
  };
}

/**
 * A public pack as the Showcase shows it.
 *
 * `authorName` and `owner` are different things and both are kept, exactly as the story card keeps
 * them apart: the author is free text the pack carries (a pseudonym, a group, a table's house
 * rules), and the owner is the account that shared it with this server. Presenting the account as
 * the author would credit it with work it may not have done.
 */
export const ShowcasePackCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  authorName: z.string().nullable(),
  version: z.number().int(),
  owner: ShowcaseOwnerSchema,
  summary: PackContentSummarySchema,
  updatedAt: z.string(),
});

export type ShowcasePackCard = z.infer<typeof ShowcasePackCardSchema>;

/** The card plus the payload. The pack travels whole - there is nothing to paginate. */
export const ShowcasePackDetailSchema = ShowcasePackCardSchema.extend({
  content: PackContentSchema,
});

export type ShowcasePackDetail = z.infer<typeof ShowcasePackDetailSchema>;
