import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1, 'Tag name cannot be empty'),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateTagDataSchema = TagSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, 'Tag name cannot be empty'),
  color: z.string().nullable().default(null),
  isFavorite: z.boolean().default(false),
  extraNotes: z.string().nullable().default(null),
});

export const PartialTagSchema = CreateTagDataSchema.partial();

export type CreateTagDataType = z.infer<typeof CreateTagDataSchema>;
export type TagType = z.infer<typeof TagSchema>;
export type PartialTagType = z.infer<typeof PartialTagSchema>;
