import { z } from 'zod';
import { ARC_MEDIUMS } from '../metadata/ArcMedium';
import { StoryVocabularySchema } from './StorySchemas';

export const ArcMediumSchema = z.enum(ARC_MEDIUMS);

// Optional with a default so exports and operations written before these fields still parse
// (the format version only moves in an official release).
export const StoryArcSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string().trim().min(1).max(120),
  description: z.string().nullable(),
  sortOrder: z.number().int().min(0),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  themeOverride: z.string().nullable(),
  medium: ArcMediumSchema.default('generic'),
  vocabulary: StoryVocabularySchema.nullable().default(null),
  author: z.string().trim().max(120).nullable().default(null),
  coverGalleryId: z.string().min(1).nullable().default(null),
  isDefault: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStoryArcDataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().nullable().default(null),
  sortOrder: z.number().int().min(0).optional(),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  themeOverride: z.string().nullable().default(null),
  medium: ArcMediumSchema.default('generic'),
  vocabulary: StoryVocabularySchema.nullable().default(null),
  author: z.string().trim().max(120).nullable().default(null),
  coverGalleryId: z.string().min(1).nullable().default(null),
  isDefault: z.boolean().default(false),
});

export const PartialStoryArcSchema = CreateStoryArcDataSchema.partial();

export type CreateStoryArcDataType = z.infer<typeof CreateStoryArcDataSchema>;
export type StoryArcRowType = z.infer<typeof StoryArcSchema>;
export type PartialStoryArcType = z.infer<typeof PartialStoryArcSchema>;
