import { NoteRelationEntities } from '@keres/shared/entities/Note';
import { z } from 'zod';

export const NoteRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  noteId: z.string(),
  relationId: z.string(),
  relationType: z.enum([
    'Character',
    'WorldRule',
    'Location',
    'Scene',
    'Chapter',
    'Choice',
  ] as const) satisfies z.ZodType<NoteRelationEntities>,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateNoteRelationDataSchema = NoteRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

export const PartialNoteRelationSchema = NoteRelationSchema.partial();

export type NoteRelationType = z.infer<typeof NoteRelationSchema>;
export type CreateNoteRelationDataType = z.infer<typeof CreateNoteRelationDataSchema>;
export type PartialNoteRelationType = z.infer<typeof PartialNoteRelationSchema>;
