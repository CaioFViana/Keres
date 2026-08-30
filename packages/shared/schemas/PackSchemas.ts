import { z } from 'zod';
import { ShowcaseOwnerSchema } from './PublicationSchemas';
import { StatNotationSchema, StoryVocabularySchema } from './StorySchemas';
import { StatSchema, StatStrengthSchema } from './StatSchemas';
import { StorySchemaFieldSchema } from './StorySchemaFieldSchemas';
import { SuggestionSchema } from './SuggestionSchemas';
import { TagSchema } from './TagSchemas';
import { UlidSchema } from './SyncSchemas';

/**
 * A pack: the reusable part of a story's *structure*, applied to a new story at creation.
 *
 * What it carries is deliberately narrow - custom attributes, suggestion catalogues, stat axes and
 * their ladders, tags. What it never carries is the writer's content: no characters, scenes,
 * chapters or locations, no `attributeValues`, no `statRelations`. A pack is the shape of a story,
 * not a story.
 *
 * The rows are whole entities rather than a reduced shape on purpose. They then satisfy the same
 * schemas the story export already uses, and applying a pack can go through the very same
 * remap-and-import path (`cloneStoryForLocalImport` -> `importFullStory`), which is also what makes
 * it record no operations - see `docs/packs_feature_plan.md` §3.
 */
export const CURRENT_PACK_FORMAT_VERSION = 1;

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

export const PackContentSchema = z.object({
  formatVersion: z.number().int().min(1).default(CURRENT_PACK_FORMAT_VERSION),
  storySchemaFields: z.array(StorySchemaFieldSchema).default([]),
  suggestions: z.array(SuggestionSchema).default([]),
  tags: z.array(TagSchema).default([]),
  stats: z.array(StatSchema).default([]),
  statStrengths: z.array(StatStrengthSchema).default([]),
  settings: PackSettingsSchema.default({ statSystem: false, statNotation: 'letter' }),
});

export type PackContentType = z.infer<typeof PackContentSchema>;

/** What the author chose to extract. Stored so re-extraction can start from the same answers. */
export const PackSelectionSchema = z.object({
  customAttributes: z.boolean().default(false),
  suggestions: z.boolean().default(false),
  /** Also harvest values used by the story's entities, not just its curated catalogue. See §5.1. */
  suggestionsIncludeUsed: z.boolean().default(false),
  stats: z.boolean().default(false),
  tags: z.boolean().default(false),
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
  statSystem: z.boolean(),
  statNotation: StatNotationSchema,
});

export type PackContentSummary = z.infer<typeof PackContentSummarySchema>;

export function summarizePackContent(content: PackContentType): PackContentSummary {
  return {
    fieldCount: content.storySchemaFields.length,
    suggestionCount: content.suggestions.length,
    tagCount: content.tags.length,
    statCount: content.stats.length,
    statSystem: content.settings.statSystem,
    statNotation: content.settings.statNotation,
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
