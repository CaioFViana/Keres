import { z } from 'zod';
import { CHAPTER_RELATION_TYPES } from '../metadata/ChapterRelationType';

/**
 * A statement about when two containers happened relative to each other.
 *
 * Both ends are `chapters` rows - an event is a chapter, so the same shape covers event/event,
 * event/chapter and chapter/chapter. See `metadata/ChapterRelationType.ts` for what the four types
 * mean and why absence is significant.
 */
export const ChapterRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  chapter1Id: z.string(),
  chapter2Id: z.string(),
  /**
   * A closed set, unlike `CharacterRelation.relationType` which is free text.
   *
   * A character relation is the writer's own vocabulary ("her rival", "the one who left"); this one
   * is read by the timeline layout and the cycle check, so an unrecognised value would be a row
   * nothing can draw and nothing can validate.
   */
  relationType: z.enum(CHAPTER_RELATION_TYPES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateChapterRelationDataSchema = ChapterRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
})
  .extend({
    chapter1Id: z.string().min(1, 'Chapter 1 ID cannot be empty'),
    chapter2Id: z.string().min(1, 'Chapter 2 ID cannot be empty'),
  })
  .refine((data) => data.chapter1Id !== data.chapter2Id, {
    message: 'A container cannot be related to itself.',
    path: ['chapter2Id'],
  });

export const PartialChapterRelationSchema = ChapterRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
})
  .partial()
  .refine((data) => !data.chapter1Id || !data.chapter2Id || data.chapter1Id !== data.chapter2Id, {
    message: 'A container cannot be related to itself.',
    path: ['chapter2Id'],
  });

export type CreateChapterRelationDataType = z.infer<typeof CreateChapterRelationDataSchema>;
export type ChapterRelationRowType = z.infer<typeof ChapterRelationSchema>;
export type PartialChapterRelationType = z.infer<typeof PartialChapterRelationSchema>;
