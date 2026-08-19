import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateNoteDataSchema = NoteSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  title: z.string().min(1, 'Note title cannot be empty'),
  isFavorite: z.boolean().default(false),
});

export const PartialNoteSchema = CreateNoteDataSchema.partial();

export type CreateNoteDataType = z.infer<typeof CreateNoteDataSchema>;
export type NoteType = z.infer<typeof NoteSchema>;
export type PartialNoteType = z.infer<typeof PartialNoteSchema>;
