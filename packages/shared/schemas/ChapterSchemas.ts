import { z } from 'zod';
import { CHAPTER_TYPES, DEFAULT_CHAPTER_TYPE } from '../metadata/ChapterType';

export const ChapterSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  index: z.number().int().min(1, 'Index must be a positive integer starting from 1'),
  /**
   * Chapter or event. Defaulted rather than required because every row written before this existed
   * has no value for it, and every one of those is a chapter.
   */
  type: z.enum(CHAPTER_TYPES).default(DEFAULT_CHAPTER_TYPE),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  /**
   * The Arc this container belongs to. Optional in the row so packages written before Arcs remain
   * importable; after migration every live chapter/event has one.
   */
  arcId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateChapterDataSchema = ChapterSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, 'Chapter name cannot be empty'),
  index: z.number().int().min(1, 'Index must be a positive integer starting from 1'),
  type: z.enum(CHAPTER_TYPES).default(DEFAULT_CHAPTER_TYPE),
  isFavorite: z.boolean().default(false),
});

export const PartialChapterSchema = CreateChapterDataSchema.partial();

export type CreateChapterDataType = z.infer<typeof CreateChapterDataSchema>;
/** The row. Named `...Row` because `ChapterType` is the chapter-or-event discriminator. */
export type ChapterRowType = z.infer<typeof ChapterSchema>;
export type PartialChapterType = z.infer<typeof PartialChapterSchema>;
