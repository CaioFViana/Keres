import { z } from 'zod';

export const TagRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  tagId: z.string().min(1, "Tag ID cannot be empty"),
  relationId: z.string().min(1, "Relation ID cannot be empty"),
  relationType: z.string().min(1, "Relation type cannot be empty"), // e.g., 'Character', 'Location', 'Scene'
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateTagRelationDataSchema = TagRelationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  tagId: z.string().min(1, "Tag ID cannot be empty"),
  relationId: z.string().min(1, "Relation ID cannot be empty"),
  relationType: z.string().min(1, "Relation type cannot be empty"),
});

export const PartialTagRelationSchema = TagRelationSchema.partial();

export type CreateTagRelationDataType = z.infer<typeof CreateTagRelationDataSchema>;
export type TagRelationType = z.infer<typeof TagRelationSchema>;
export type PartialTagRelationType = z.infer<typeof PartialTagRelationSchema>;