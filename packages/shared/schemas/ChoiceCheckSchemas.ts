import { z } from 'zod';

export const ChoiceCheckSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  groupId: z.string(),
  mode: z.enum(['block', 'enable']),
  type: z.enum(['sceneCount', 'inventory', 'trigger']),
  order: z.number(),
  sceneId: z.string().nullable(),
  minVisits: z.number().nullable(),
  itemId: z.string().nullable(),
  itemPresence: z.enum(['has', 'lacks']).nullable(),
  triggerName: z.string().nullable(),
  triggerState: z.enum(['set', 'unset']).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateChoiceCheckDataSchema = ChoiceCheckSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  groupId: z.string().min(1, "Group ID cannot be empty"),
  mode: z.enum(['block', 'enable']).default('block'),
  type: z.enum(['sceneCount', 'inventory', 'trigger']),
  order: z.number().default(0),
  sceneId: z.string().nullable().default(null),
  minVisits: z.number().nullable().default(null),
  itemId: z.string().nullable().default(null),
  itemPresence: z.enum(['has', 'lacks']).nullable().default(null),
  triggerName: z.string().nullable().default(null),
  triggerState: z.enum(['set', 'unset']).nullable().default(null),
});

export const PartialChoiceCheckSchema = ChoiceCheckSchema.partial();

export type CreateChoiceCheckDataType = z.infer<typeof CreateChoiceCheckDataSchema>;
export type ChoiceCheckType = z.infer<typeof ChoiceCheckSchema>;
export type PartialChoiceCheckType = z.infer<typeof PartialChoiceCheckSchema>;
