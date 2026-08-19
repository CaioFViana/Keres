import { z } from 'zod';

export const ChoiceCheckGroupSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  choiceId: z.string(),
  combinator: z.enum(['AND', 'OR']),
  order: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateChoiceCheckGroupDataSchema = ChoiceCheckGroupSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  choiceId: z.string().min(1, 'Choice ID cannot be empty'),
  combinator: z.enum(['AND', 'OR']).default('AND'),
  order: z.number().default(0),
});

export const PartialChoiceCheckGroupSchema = CreateChoiceCheckGroupDataSchema.partial();

export type CreateChoiceCheckGroupDataType = z.infer<typeof CreateChoiceCheckGroupDataSchema>;
export type ChoiceCheckGroupType = z.infer<typeof ChoiceCheckGroupSchema>;
export type PartialChoiceCheckGroupType = z.infer<typeof PartialChoiceCheckGroupSchema>;
