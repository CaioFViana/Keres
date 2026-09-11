import type { StoryVocabulary } from '../entities/Story';
import { UlidSchema } from '../schemas/SyncSchemas'; // Adjusted path
import { z } from 'zod';

export const StoryTypeSchema = z.enum(['linear', 'branching']);
export const FavoriteBehaviorSchema = z.enum(['global', 'individual', 'individual_public']);
export const StatNotationSchema = z.enum(['letter', 'number']);

export const StoryVocabularyTermSchema = z.object({
  singular: z.string().trim().min(1).max(80),
  plural: z.string().trim().min(1).max(80),
  grammaticalGender: z.enum(['masculine', 'feminine', 'neutral']),
});

/**
 * Persisted terminology is deliberately one language wide. The user writes it once; the app
 * falls back to its normal translated terminology while being read in another locale.
 */
export const StoryVocabularySchema: z.ZodType<StoryVocabulary> = z.object({
  version: z.literal(1),
  language: z.enum(['pt', 'en']),
  terms: z.object({
    Character: StoryVocabularyTermSchema.optional(),
    Location: StoryVocabularyTermSchema.optional(),
    Chapter: StoryVocabularyTermSchema.optional(),
    Scene: StoryVocabularyTermSchema.optional(),
    Event: StoryVocabularyTermSchema.optional(),
    Item: StoryVocabularyTermSchema.optional(),
    WorldRule: StoryVocabularyTermSchema.optional(),
    Choice: StoryVocabularyTermSchema.optional(),
    Arc: StoryVocabularyTermSchema.optional(),
  }),
});

// Schema for client-provided input during story creation
export const StoryCreateInputSchema = z.object({
  id: UlidSchema, // Client provides ULID
  title: z.string().min(1, 'Title cannot be empty'),
  type: StoryTypeSchema,
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  isFavorite: z.boolean().default(false),
  favoriteBehavior: FavoriteBehaviorSchema.default('individual'),
  extraNotes: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  timelineEpochDay: z.number().int().nullable().default(null),
  timelineEpochSeconds: z.number().int().nonnegative().nullable().default(null),
  normalizeSceneTiming: z.boolean().default(false),
  allowReaderComments: z.boolean().default(false),
  autoLinkMentions: z.boolean().default(false),
  completenessChecks: z.boolean().default(false),
  statSystem: z.boolean().default(false),
  statNotation: StatNotationSchema.default('letter'),
  vocabulary: StoryVocabularySchema.nullable().default(null),
});

// Schema for the 'data' payload when creating a story via sync
export const CreateStoryDataSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  type: StoryTypeSchema,
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  isFavorite: z.boolean().default(false),
  favoriteBehavior: FavoriteBehaviorSchema.default('individual'),
  extraNotes: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  timelineEpochDay: z.number().int().nullable().default(null),
  timelineEpochSeconds: z.number().int().nonnegative().nullable().default(null),
  normalizeSceneTiming: z.boolean().default(false),
  allowReaderComments: z.boolean().default(false),
  autoLinkMentions: z.boolean().default(false),
  completenessChecks: z.boolean().default(false),
  statSystem: z.boolean().default(false),
  statNotation: StatNotationSchema.default('letter'),
  vocabulary: StoryVocabularySchema.nullable().default(null),
});

// Full Story Schema, including server-managed fields like userId
export const StorySchema = StoryCreateInputSchema.extend({
  userId: UlidSchema, // userId is set by the server
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
  version: z.number().int().min(1).default(1),
  isDeleted: z.boolean().default(false),
  deletedAt: z.coerce.date().nullable().optional(),
});

export const PartialStorySchema = CreateStoryDataSchema.partial();
