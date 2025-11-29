import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1, "Tag name cannot be empty"),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateTagDataSchema = TagSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, "Tag name cannot be empty"),
  color: z.string().nullable().default(null),
  isFavorite: z.boolean().default(false),
  extraNotes: z.string().nullable().default(null),
});

export const PartialTagSchema = TagSchema.partial();

export type CreateTagDataType = z.infer<typeof CreateTagDataSchema>;
export type TagType = z.infer<typeof TagSchema>;
export type PartialTagType = z.infer<typeof PartialTagSchema>;
