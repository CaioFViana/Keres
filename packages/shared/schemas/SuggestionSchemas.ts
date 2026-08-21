import { z } from 'zod';

export const SuggestionSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  type: z.string().min(1, 'Suggestion type cannot be empty'),
  value: z.string().min(1, 'Suggestion value cannot be empty'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateSuggestionDataSchema = SuggestionSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  type: z.string().min(1, 'Suggestion type cannot be empty'),
  value: z.string().min(1, 'Suggestion value cannot be empty'),
});

export const PartialSuggestionSchema = CreateSuggestionDataSchema.partial();

export type CreateSuggestionDataType = z.infer<typeof CreateSuggestionDataSchema>;
export type SuggestionType = z.infer<typeof SuggestionSchema>;
export type PartialSuggestionType = z.infer<typeof PartialSuggestionSchema>;
