import { z } from 'zod';
import { COMMENT_ENTITY_TYPES } from '../metadata/CommentEntityType';

export const CommentEntityTypeSchema = z.enum(COMMENT_ENTITY_TYPES);
export const CommentCriticalitySchema = z.number().int().min(1).max(5);

export const CommentSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  entityType: CommentEntityTypeSchema,
  entityId: z.string().min(1),
  fieldId: z.string().nullable(),
  fieldKey: z.string().nullable(),
  contentSnapshot: z.string().nullable(),
  excerptText: z.string().nullable(),
  authorUserId: z.string(),
  commentText: z.string().min(1, 'Comment text cannot be empty'),
  criticality: CommentCriticalitySchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateCommentDataSchema = CommentSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).refine(data => (data.fieldId === null) !== (data.fieldKey === null), {
  message: 'Exactly one of fieldId or fieldKey must be set.',
  path: ['fieldKey'],
});

export const PartialCommentSchema = CommentSchema.partial();

export type CreateCommentDataType = z.infer<typeof CreateCommentDataSchema>;
export type CommentSchemaType = z.infer<typeof CommentSchema>;
export type PartialCommentType = z.infer<typeof PartialCommentSchema>;
